'use strict';

// handles every gridfs operation.

var fs = require('fs');
var db = require('../db');
var files = db.files();
var chunks = db.chunks();
var bucket = new (require('mongodb')).GridFSBucket(db.conn());
var disable304;
var verbose;
var miscOps;
var zlib = require('zlib');

var streamableMimes = [ 'video/webm', 'audio/mpeg', 'video/mp4', 'video/ogg',
    'audio/ogg', 'audio/webm' ];
var permanentTypes = [ 'media', 'graph' ];

exports.loadSettings = function() {

  var settings = require('../settingsHandler').getGeneralSettings();

  disable304 = settings.disable304;
  verbose = settings.verbose;
};

exports.loadDependencies = function() {
  miscOps = require('./miscOps');
};

exports.removeDuplicates = function(uploadStream, callback) {

  files.aggregate([ {
    $match : {
      _id : {
        $ne : uploadStream.id
      },
      filename : uploadStream.filename
    }
  }, {
    $group : {
      _id : 0,
      ids : {
        $push : '$_id'
      }
    }
  } ]).toArray(function gotArray(error, results) {

    if (error) {
      callback(error);
    } else if (!results.length) {
      callback();
    } else {

      var ids = results[0].ids;

      // style exception, too simple
      chunks.removeMany({
        'files_id' : {
          $in : ids
        }
      }, function removedChunks(error) {

        if (error) {
          callback(error);
        } else {

          files.removeMany({
            _id : {
              $in : ids
            }
          }, callback);

        }

      });
      // style exception, too simple

    }
  });
};

// start of writing data
exports.compressData = function(data, dest, mime, meta, callback) {

  zlib.gzip(data, function gotCompressedData(error, data) {
    if (error) {
      callback(error);
    } else {
      exports.writeData(data, dest + '.gz', mime, meta, callback, true);
    }

  });

};

exports.writeData = function(data, dest, mime, meta, callback, compressed) {

  if (typeof (data) === 'string') {

    data = new Buffer(data, 'utf-8');
  }

  if (!compressed) {

    if (!meta.languages) {
      meta.lastModified = new Date();
    }

    if (miscOps.isPlainText(mime)) {
      meta.compressed = true;
    }
  }

  if (verbose) {
    console.log('Writing data on gridfs under \'' + dest + '\'');
  }

  var uploadStream = bucket.openUploadStream(dest, {
    contentType : mime,
    metadata : meta
  });

  uploadStream.on('error', callback);

  uploadStream.on('finish', function finished() {

    // style exception, too simple
    exports.removeDuplicates(uploadStream, function removedDuplicates(error) {

      if (error) {
        callback(error);
      } else {

        if (!compressed && meta.compressed) {
          exports.compressData(data, dest, mime, meta, callback);
        } else {
          callback();
        }

      }

    });
    // style exception, too simple

  });

  uploadStream.write(data);

  uploadStream.end();

};
// end of writing data

exports.writeFile = function(path, dest, mime, meta, callback) {

  meta.lastModified = new Date();

  if (verbose) {
    var message = 'Writing ' + mime + ' file on gridfs under \'';
    message += dest + '\'';
    console.log(message);
  }

  var readStream = fs.createReadStream(path);

  var uploadStream = bucket.openUploadStream(dest, {
    contentType : mime,
    metadata : meta
  });

  readStream.on('error', callback);
  uploadStream.on('error', callback);

  uploadStream.once('finish', function uploaded() {
    exports.removeDuplicates(uploadStream, callback);
  });

  readStream.pipe(uploadStream);

};

exports.removeFiles = function(name, callback) {

  if (typeof (name) === 'string') {
    name = [ name ];
  }

  files.aggregate([ {
    $match : {
      filename : {
        $in : name
      }
    }
  }, {
    $group : {
      _id : 0,
      ids : {
        $push : '$_id'
      }
    }
  } ], function gotFiles(error, results) {

    if (error) {
      if (callback) {
        callback();
      }
    } else if (!results.length) {
      callback();
    } else {

      var ids = results[0].ids;

      // style exception, too simple
      chunks.removeMany({
        'files_id' : {
          $in : ids
        }
      }, function removedChunks(error) {

        if (error) {
          callback(error);
        } else {

          files.removeMany({
            _id : {
              $in : ids
            }
          }, callback);

        }

      });
      // style exception, too simple
    }

  });

};

// start of outputting file
exports.setExpiration = function(header, stats) {
  var expiration = new Date();

  if (permanentTypes.indexOf(stats.metadata.type) > -1) {
    expiration.setFullYear(expiration.getFullYear() + 1);
  }

  header.push([ 'expires', expiration.toUTCString() ]);
};

exports.setCookies = function(header, cookies) {
  if (cookies) {

    for (var i = 0; i < cookies.length; i++) {
      var cookie = cookies[i];

      var toPush = [ 'Set-Cookie', cookie.field + '=' + cookie.value ];

      if (cookie.expiration) {
        toPush[1] += '; expires=' + cookie.expiration.toUTCString();
      }

      if (cookie.path) {
        toPush[1] += '; path=' + cookie.path;
      }

      header.push(toPush);

    }
  }
};

exports.readRangeHeader = function(range, totalLength) {

  if (!range || range.length === 0) {
    return null;
  }

  var array = range.split(/bytes=([0-9]*)-([0-9]*)/);
  var start = parseInt(array[1]);
  var end = parseInt(array[2]);
  var result = {
    start : isNaN(start) ? 0 : start,
    end : isNaN(end) ? (totalLength - 1) : end
  };

  if (!isNaN(start) && isNaN(end)) {
    result.start = start;
    result.end = totalLength - 1;
  }

  if (isNaN(start) && !isNaN(end)) {
    result.start = totalLength - end;
    result.end = totalLength - 1;
  }

  return result;
};

exports.getHeader = function(stats, req, cookies) {
  var header = miscOps.corsHeader(stats.contentType);
  var lastM = stats.metadata.lastModified || stats.uploadDate;
  header.push([ 'last-modified', lastM.toUTCString() ]);

  exports.setExpiration(header, stats);

  exports.setCookies(header, cookies);

  return header;
};

// Side effects: push data to the header and adds fields to options
exports.isRangeValid = function(range, options, stats, header, res) {

  // If the range can't be fulfilled.
  if (range.start >= stats.length || range.end >= stats.length) {

    if (verbose) {
      console.log('416');
    }

    header.push([ 'Content-Range', 'bytes */' + stats.length ]);
    res.writeHead(416, header);

    res.end();
    return false;
  }

  header.push([ 'Content-Range',
      'bytes ' + range.start + '-' + range.end + '/' + stats.length ]);

  options.start = range.start;
  options.end = range.end;

  return true;

};

exports.streamFile = function(stream, range, stats, req, res, header, cookies,
    retries, callback) {

  var wrote = false;

  stream.on('data', function(chunk) {

    if (!wrote) {
      wrote = true;

      if (stats.metadata.compressed) {

        if (req.compressed) {
          header.push([ 'Content-Encoding', 'gzip' ]);
        }

        header.push([ 'Vary', 'Accept-Encoding' ]);
      }

      header.push([ 'Vary', 'Accept-Language' ]);

      if (stats.metadata.languages) {

        header
            .push([ 'Content-Language', stats.metadata.languages.join(', ') ]);
      }

      res.writeHead(range ? 206 : (stats.metadata.status || 200), header);
    }

    res.write(chunk);

  });

  stream.on('end', function() {
    res.end();
    callback();
  });

  stream.on('error', function(error) {

    retries = retries || 0;

    if (wrote || retries >= 9) {
      callback(error);
    } else {

      // We failed before writing anything, wait 10ms and try again
      setTimeout(function() {
        exports.prepareStream(stats, req, callback, cookies, res, ++retries);
      }, 10);

    }

  });

};

exports.prepareStream = function(stats, req, callback, cookies, res, retries) {

  var header = exports.getHeader(stats, req, cookies);

  var range;

  if (streamableMimes.indexOf(stats.contentType) > -1) {
    range = exports.readRangeHeader(req.headers.range, stats.length);
    header.push([ 'Accept-Ranges', 'bytes' ]);
  }

  var options = {
    revision : 0
  };

  var length;

  if (range) {

    if (!exports.isRangeValid(range, options, stats, header, res)) {
      callback();
      return;
    }

    length = range.end - range.start + 1;

  } else {
    length = stats.length;
  }

  header.push([ 'Content-Length', length ]);

  exports.streamFile(bucket.openDownloadStreamByName(stats.filename, options),
      range, stats, req, res, header, cookies, retries, callback);

};

exports.shouldOutput304 = function(lastSeen, stats) {

  stats.metadata = stats.metadata || {};

  var lastM = stats.metadata.lastModified || stats.uploadDate;

  var mTimeMatches = lastSeen === lastM.toUTCString();

  return mTimeMatches && !disable304 && !stats.metadata.status;
};

exports.decideOnCompression = function(req, res, fileStats, compressed,
    language, file, cookies, retry, callback) {

  if (req.compressed && fileStats.metadata.compressed && !compressed) {
    file += '.gz';

    exports.outputFile(file, req, res, callback, cookies, retry, true,
        language, fileStats);
  } else {
    exports.prepareStream(fileStats, req, callback, cookies, res);
  }

};

exports.decideOnLanguage = function(req, res, fileStats, compressed, language,
    file, cookies, retry, callback) {

  if (req.language && !language) {

    var languageString = req.language.headerValues.join('-');

    files.findOne({
      filename : file + languageString
    }, function gotFile(error, result) {

      if (error) {
        callback(error);
      } else {

        if (result) {
          file += languageString;
        }

        exports.outputFile(file, req, res, callback, cookies, retry, false,
            true, fileStats);

      }

    });

  } else {
    exports.decideOnCompression(req, res, fileStats, compressed, language,
        file, cookies, retry, callback);
  }

};

exports.output304 = function(fileStats, res) {

  if (verbose) {
    console.log('304');
  }

  var header = [ [ 'Vary', 'Accept-Language' ] ];
  exports.setExpiration(header, fileStats);

  if (fileStats.metadata.compressed) {
    header.push([ 'Vary', 'Accept-Encoding' ]);
  }

  res.writeHead(304, header);
  res.end();

};

// retry means it has already failed to get a page and now is trying to get the
// 404 page. It prevents infinite recursion
exports.outputFile = function(file, req, res, callback, cookies, retry,
    compressed, language, originalStats) {

  if (verbose) {
    console.log('Outputting \'' + file + '\' from gridfs');
  }

  var lastSeen = req.headers ? req.headers['if-modified-since'] : null;

  files.findOne({
    filename : file
  }, {
    uploadDate : 1,
    'metadata.lastModified' : 1,
    'metadata.status' : 1,
    'metadata.type' : 1,
    'metadata.compressed' : 1,
    'metadata.languages' : 1,
    length : 1,
    contentType : 1,
    filename : 1,
    _id : 0
  }, function gotFile(error, fileStats) {
    if (error) {
      callback(error);
    } else if (!fileStats) {
      if (retry) {
        callback({
          code : 'ENOENT'
        });
      } else {
        exports.outputFile('/404.html', req, res, callback, cookies, true);
      }

    } else if (exports.shouldOutput304(lastSeen, fileStats)) {
      exports.output304(fileStats, res);
    } else {

      if (originalStats) {
        fileStats.metadata.lastModified = originalStats.metadata.lastModified;
      }

      exports.decideOnLanguage(req, res, fileStats, compressed, language, file,
          cookies, retry, callback);
    }
  });

};
// end of outputting file
