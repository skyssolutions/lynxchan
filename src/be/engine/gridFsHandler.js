'use strict';

// handles every gridfs operation.

var db = require('../db');
var files = db.files();
var conn = db.conn();
var mongo = require('mongodb');
var disable304;
var verbose;
var noDaemon = require('../kernel').noDaemon();
var miscOps;
var zlib = require('zlib');

var chunkSize = 1024 * 255;
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

// start of writing data
exports.writeDataOnOpenFile = function(gs, data, callback, meta, mime,
    destination, compressed) {

  if (typeof (data) === 'string') {
    data = new Buffer(data, 'utf-8');
  }

  gs.write(data, true, function wroteData(error) {

    if (!compressed && meta.compressed) {

      // style exception, too simple
      zlib.gzip(data, function gotCompressedData(error, data) {
        if (error) {
          callback(error);
        } else {
          exports.writeData(data, destination + '.gz', mime, meta, callback,
              true);
        }

      });
      // style exception, too simple

    } else {
      callback(error);
    }
  });

};

exports.writeData = function(data, dest, mime, meta, callback, compressed) {

  if (!compressed) {
    meta.lastModified = new Date();

    if (miscOps.isPlainText(mime)) {
      meta.compressed = true;
    }
  }

  if (verbose) {
    console.log('Writing data on gridfs under \'' + dest + '\'');
  }

  var gs = mongo.GridStore(conn, dest, 'w', {
    'content_type' : mime,
    metadata : meta
  });

  gs.open(function openedGs(error, gs) {

    if (error) {
      callback(error);
    } else {
      exports.writeDataOnOpenFile(gs, data, callback, meta, mime, dest,
          compressed);
    }
  });

};
// end of writing data

// start of transferring file to gridfs
exports.writeFileOnOpenFile = function(gs, path, callback, destination, meta,
    mime) {
  gs.writeFile(path, function wroteFile(error) {

    // style exception, too simple
    gs.close(function closed(closeError, result) {
      callback(error || closeError);
    });
    // style exception, too simple

  });
};

exports.writeFile = function(path, dest, mime, meta, callback) {

  meta.lastModified = new Date();

  if (verbose) {
    var message = 'Writing ' + mime + ' file on gridfs under \'';
    message += dest + '\'';
    console.log(message);
  }

  var gs = mongo.GridStore(conn, dest, 'w', {
    'content_type' : mime,
    metadata : meta
  });

  gs.open(function openedGs(error, gs) {

    if (error) {
      callback(error);
    } else {
      exports.writeFileOnOpenFile(gs, path, callback, dest, meta, mime);
    }
  });

};
// end of transferring file to gridfs

exports.removeFiles = function(name, callback) {

  mongo.GridStore.unlink(conn, name, function deleted(error) {
    if (callback) {
      callback(error);
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

exports.finishPartialStream = function(res, gs, callback) {
  res.end();
  gs.close();
  callback();
};

exports.readParts = function(currentPosition, res, range, gs, callback) {

  var toRead = chunkSize;

  if (range.end - currentPosition < chunkSize) {
    toRead = range.end - currentPosition + 1;
  }

  if (verbose) {
    var message = 'About to read ' + toRead + ' bytes from position ';
    message += currentPosition;

    console.log(message);

  }

  gs.read(toRead, function readChunk(error, chunk) {
    if (error) {
      callback(error);
      gs.close();
    } else {
      if (verbose) {
        console.log('Read ' + chunk.length + ' bytes.');
      }

      currentPosition += chunk.length;

      res.write(chunk);

      if (currentPosition >= range.end || gs.eof()) {

        if (verbose) {
          console.log('Finished reading.');
        }

        exports.finishPartialStream(res, gs, callback);

      } else {
        if (verbose) {
          console.log(range.end - currentPosition + ' bytes left to read.');
        }

        exports.readParts(currentPosition, res, range, gs, callback);
      }

    }
  });

};

exports.streamRange = function(range, gs, header, res, stats, callback) {

  if (verbose) {
    console.log('Outputting range ' + JSON.stringify(range, null, 2));
  }

  // If the range can't be fulfilled.
  if (range.start >= stats.length || range.end >= stats.length) {

    if (verbose) {
      console.log('416');
    }

    header.push([ 'Content-Range', 'bytes */' + stats.length ]);
    res.writeHead(416, header);

    res.end();
    return;
  }

  header.push([ 'Content-Range',
      'bytes ' + range.start + '-' + range.end + '/' + stats.length ]);

  res.writeHead(206, header);

  gs.seek(range.start, function skipped(error) {
    if (error) {
      callback(error);
      gs.close();
    } else {
      exports.readParts(range.start, res, range, gs, callback);

    }
  });

};

exports.getHeader = function(stats, req, cookies) {
  var header = miscOps.corsHeader(stats.contentType);
  var lastM = stats.metadata.lastModified || stats.uploadDate;
  header.push([ 'last-modified', lastM.toUTCString() ]);

  exports.setExpiration(header, stats);

  exports.setCookies(header, cookies);

  return header;
};

exports.streamFile = function(stats, req, callback, cookies, res, retries) {

  var header = exports.getHeader(stats, req, cookies);

  var range;

  if (streamableMimes.indexOf(stats.contentType) > -1) {
    range = exports.readRangeHeader(req.headers.range, stats.length);
    header.push([ 'Accept-Ranges', 'bytes' ]);
  }

  var gs = mongo.GridStore(conn, stats.filename, 'r');

  gs.open(function openedGs(error, gs) {

    if (!error) {
      if (!range) {

        var stream = gs.stream();

        var wrote = false;

        stream.on('data', function(chunk) {

          if (!wrote) {
            wrote = true;
            header.push([ 'Content-Length', stats.length ]);

            if (stats.metadata.compressed) {

              if (req.compressed) {
                header.push([ 'Content-Encoding', 'gzip' ]);
              }

              header.push([ 'Vary', 'Accept-Encoding' ]);
            }

            res.writeHead(stats.metadata.status || 200, header);
          }

          res.write(chunk);

        });

        stream.on('error', function(error) {

          gs.close();
          retries = retries || 0;

          if (wrote || retries >= 9) {
            callback(error);
          } else {

            // We failed before writing anything, wait 100ms and try again
            setTimeout(
                function() {
                  exports.streamFile(stats, req, callback, cookies, res,
                      ++retries);
                }, 10);

          }

        });

        stream.on('end', function() {

          gs.close();
          res.end();
          callback();
        });

      } else {
        exports.streamRange(range, gs, header, res, stats, callback);
      }
    } else {
      callback(error);
    }
  });

};

exports.shouldOutput304 = function(lastSeen, stats) {

  stats.metadata = stats.metadata || {};

  var lastM = stats.metadata.lastModified || stats.uploadDate;

  var mTimeMatches = lastSeen === lastM.toUTCString();

  return mTimeMatches && !disable304 && !stats.metadata.status;
};

exports.decideOnCompression = function(req, res, fileStats, compressed, file,
    cookies, retry, callback) {

  if (req.compressed && fileStats.metadata.compressed && !compressed) {
    file += '.gz';

    exports.outputFile(file, req, res, callback, cookies, retry, true);
  } else {
    exports.streamFile(fileStats, req, callback, cookies, res);
  }

};

// retry means it has already failed to get a page and now is trying to get the
// 404 page. It prevents infinite recursion
exports.outputFile = function(file, req, res, callback, cookies, retry,
    compressed) {

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
      if (verbose) {
        console.log('304');

      }

      var header = [];
      exports.setExpiration(header, fileStats);

      if (fileStats.metadata.compressed) {
        header.push([ 'Vary', 'Accept-Encoding' ]);
      }

      res.writeHead(304, header);
      res.end();
    } else {
      exports.decideOnCompression(req, res, fileStats, compressed, file,
          cookies, retry, callback);
    }
  });

};
// end of outputting file
