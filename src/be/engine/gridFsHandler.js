'use strict';

// handles every gridfs operation.

var fs = require('fs');
var db = require('../db');
var files = db.files();
var chunks = db.chunks();
var bucket = new (require('mongodb')).GridFSBucket(db.conn());
var disable304;
var verbose;
var alternativeLanguages;
var miscOps;
var requestHandler;
var zlib = require('zlib');

exports.permanentTypes = [ 'media', 'graph' ];

exports.loadSettings = function() {

  var settings = require('../settingsHandler').getGeneralSettings();

  disable304 = settings.disable304;
  verbose = settings.verbose || settings.verboseGridfs;
  alternativeLanguages = settings.useAlternativeLanguages;
};

exports.loadDependencies = function() {
  miscOps = require('./miscOps');
  requestHandler = require('./requestHandler');
};

exports.removeDuplicates = function(uploadStream, callback) {

  files.aggregate([ {
    $match : {
      _id : {
        $ne : uploadStream.id
      },
      $or : [ {
        filename : uploadStream.filename
      }, {
        'metadata.referenceFile' : uploadStream.filename
      } ]
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

      meta.referenceFile = meta.referenceFile || dest;

      exports.writeData(data, dest + '.gz', mime, meta, callback, true);
    }

  });

};

exports.writeData = function(data, dest, mime, meta, callback, compressed) {

  if (typeof (data) === 'string') {

    data = Buffer.from(data, 'utf-8');
  }

  if (!compressed) {

    meta.lastModified = new Date();

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

  uploadStream.once('error', callback);

  uploadStream.once('finish', function finished() {

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
    exports.removeDuplicates(uploadStream, function(error) {
      callback(error, uploadStream.id);
    });
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
  } ]).toArray(function gotFiles(error, results) {

    if (error) {
      if (callback) {
        callback();
      }
    } else if (!results.length) {
      callback();
    } else {

      // style exception, too simple
      chunks.removeMany({
        'files_id' : {
          $in : results[0].ids
        }
      }, function removedChunks(error) {

        if (error) {
          callback(error);
        } else {

          files.removeMany({
            _id : {
              $in : results[0].ids
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

  if (exports.permanentTypes.indexOf(stats.metadata.type) > -1) {
    expiration.setFullYear(expiration.getFullYear() + 1);
  }

  header.push([ 'expires', expiration.toUTCString() ]);
};

exports.getHeader = function(stats, req) {

  var header = [];
  var lastM = stats.metadata.lastModified || stats.uploadDate;
  header.push([ 'last-modified', lastM.toUTCString() ]);

  exports.setExpiration(header, stats);

  return header;
};

exports.streamFile = function(stream, range, stats, req, res, header, retries,
    callback) {

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

      if (alternativeLanguages) {
        header.push([ 'Vary', 'Accept-Language' ]);
      }

      if (stats.metadata.languages) {

        header
            .push([ 'Content-Language', stats.metadata.languages.join(', ') ]);
      }

      res.writeHead(range ? 206 : (stats.metadata.status || 200), miscOps
          .getHeader(stats.contentType, null, header));
    }

    res.write(chunk);

  });

  stream.once('end', function() {
    res.end();
    callback();
  });

  stream.once('error', function(error) {

    retries = retries || 0;

    if (wrote || retries >= 9) {
      callback(error);
    } else {

      // We failed before writing anything, wait 10ms and try again
      setTimeout(function() {
        exports.prepareStream(stats, req, callback, res, ++retries);
      }, 10);

    }

  });

};

exports.handleRangeSettings = function(options, range, stats, header) {

  options.start = range.start;
  options.end = range.end + 1;

  header.push([ 'Content-Range',
      'bytes ' + range.start + '-' + range.end + '/' + stats.length ]);

  return range.end - range.start + 1;

};

exports.prepareStream = function(stats, req, callback, res, retries) {

  var header = exports.getHeader(stats, req);

  var range = requestHandler.readRangeHeader(req.headers.range, stats.length);
  header.push([ 'Accept-Ranges', 'bytes' ]);

  var options = {
    revision : 0
  };

  var length;

  if (range) {
    length = exports.handleRangeSettings(options, range, stats, header);
  } else {
    length = stats.length;
  }

  header.push([ 'Content-Length', length ]);

  exports.streamFile(bucket.openDownloadStreamByName(stats.filename, options),
      range, stats, req, res, header, retries, callback);

};

exports.output304 = function(fileStats, res) {

  var header = [];

  if (alternativeLanguages) {
    header.push([ 'Vary', 'Accept-Language' ]);
  }

  exports.setExpiration(header, fileStats);

  if (fileStats.metadata.compressed) {
    header.push([ 'Vary', 'Accept-Encoding' ]);
  }

  res.writeHead(304, miscOps.convertHeader(header));
  res.end();

};

exports.shouldOutput304 = function(req, stats) {

  stats.metadata = stats.metadata || {};

  var lastModified = stats.metadata.lastModified || stats.uploadDate;

  var mTimeMatches = req.headers['if-modified-since'] === lastModified
      .toUTCString();

  return mTimeMatches && !disable304 && !stats.metadata.status;

};

exports.takeLanguageFile = function(file, req, currentPick) {

  var isCompressed = file.filename.indexOf('.gz') === file.filename.length - 3;

  var takesCompressed = !!req.compressed;
  var toRet = takesCompressed === isCompressed;

  return toRet || (!currentPick && !isCompressed);

};

exports.handlePickedFile = function(finalPick, req, res, callback) {

  if (!finalPick) {
    exports.outputFile('/404.html', req, res, callback);
  } else if (exports.shouldOutput304(req, finalPick)) {
    exports.output304(finalPick, res);
  } else {
    if (verbose) {
      console.log('Streaming \'' + finalPick.filename + '\'');
    }
    exports.prepareStream(finalPick, req, callback, res);
  }

};

exports.pickFile = function(fileRequested, req, res, possibleFiles, callback) {

  var vanilla;
  var compressed;
  var language;

  for (var i = 0; i < possibleFiles.length; i++) {

    var file = possibleFiles[i];

    if (fileRequested === file.filename) {
      vanilla = file;
    } else if (!file.metadata.languages && req.compressed) {
      compressed = file;
    } else if (exports.takeLanguageFile(file, req, language)) {
      language = file;
    }
  }

  exports.handlePickedFile(language || compressed || vanilla, req, res,
      callback);

};

exports.outputFile = function(file, req, res, callback) {

  if (verbose) {
    console.log('Outputting \'' + file + '\' from gridfs');
  }

  var languageCondition = req.language ? {
    $or : [ {
      'metadata.languages' : {
        $exists : false
      }
    }, {
      'metadata.languages' : {
        $in : req.language.headerValues
      }
    } ]
  } : {
    'metadata.languages' : {
      $exists : false
    }
  };

  files.find({
    $or : [ {
      $and : [ {
        'metadata.referenceFile' : file
      }, languageCondition ]
    }, {
      filename : file
    } ]
  }).toArray(function gotFiles(error, possibleFiles) {

    if (error) {
      callback(error);
    } else if (!possibleFiles.length) {

      if (file === '/404.html') {
        callback({
          code : 'ENOENT'
        });
      } else {
        exports.outputFile('/404.html', req, res, callback);
      }

    } else {
      exports.pickFile(file, req, res, possibleFiles, callback);
    }
  });

};
// end of outputting file
