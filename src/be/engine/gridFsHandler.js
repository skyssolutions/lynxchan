'use strict';
// handles every gridfs operation.
// writing, deleting, outputting files

var db = require('../db');
var files = db.files();
var conn = db.conn();
var mongo = require('mongodb');
var settings = require('../boot').getGeneralSettings();
var disable304 = settings.disable304;
var verbose = settings.verbose;
var miscOps = require('./miscOps');
var permanentTypes = [ 'media', 'preview' ];
var streamableMimes = [ 'video/webm' ];
var chunkSize = 1024 * 255;

// start of writing data
function writeDataOnOpenFile(gs, data, callback) {

  if (typeof (data) === 'string') {
    data = new Buffer(data, 'utf-8');
  }

  gs.write(data, true, function wroteData(error) {

    callback(error);

  });

}

exports.writeData = function(data, destination, mime, meta, callback) {

  if (verbose) {
    console.log('Writing data on gridfs under \'' + destination + '\'');
  }

  var gs = mongo.GridStore(conn, destination, 'w', {
    'content_type' : mime,
    metadata : meta
  });

  exports.removeFiles(destination, function clearedFile(error) {
    if (error) {
      callback(error);
    } else {

      // style exception, the parent callback is too simple
      gs.open(function openedGs(error, gs) {

        if (error) {
          callback(error);
        } else {
          writeDataOnOpenFile(gs, data, callback);
        }
      });

    }
    // style exception, the parent callback is too simple

  });

};
// end of writing data

// start of transferring file to gridfs
function writeFileOnOpenFile(gs, path, callback) {
  gs.writeFile(path, function wroteFile(error) {

    // style exception, too simple
    gs.close(function closed(closeError, result) {
      callback(error || closeError);
    });
    // style exception, too simple

  });
}

exports.writeFile = function(path, destination, mime, meta, callback) {

  if (verbose) {
    var message = 'Writing ' + mime + ' file on gridfs under \'';
    message += destination + '\' from ' + path;
    console.log(message);
  }

  var gs = mongo.GridStore(conn, destination, 'w', {
    'content_type' : mime,
    metadata : meta
  });

  exports.removeFiles(destination, function clearedFile(error) {
    if (error) {
      callback(error);
    } else {

      // style exception, too simple
      gs.open(function openedGs(error, gs) {

        if (error) {
          callback(error);
        } else {
          writeFileOnOpenFile(gs, path, callback);
        }
      });
      // style exception, too simple

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

function setExpiration(header, stats) {
  var expiration = new Date();

  if (permanentTypes.indexOf(stats.metadata.type) > -1) {
    expiration.setFullYear(expiration.getFullYear() + 1);
  }

  header.push([ 'expires', expiration.toString() ]);
}

function setCookies(header, cookies) {
  if (cookies) {

    for (var i = 0; i < cookies.length; i++) {
      var cookie = cookies[i];

      var toPush = [ 'Set-Cookie', cookie.field + '=' + cookie.value ];

      if (cookie.expiration) {
        toPush[1] += '; expires=' + cookie.expiration.toString();
      }

      if (cookie.path) {
        toPush[1] += '; path=' + cookie.path;
      }

      header.push(toPush);

    }
  }
}

function readRangeHeader(range, totalLength) {

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
}

function finishPartialStream(res, gs, callback) {
  res.end();
  gs.close();
  callback();
}

function readParts(currentPosition, res, range, gs, callback) {

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
      console.log(error);
      callback(error);
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
        finishPartialStream(res, gs, callback);

      } else {
        if (verbose) {
          console.log(range.end - currentPosition + ' bytes left to read.');
        }

        readParts(currentPosition, res, range, gs, callback);
      }

    }
  });

}

function streamRange(range, gs, header, res, stats, callback) {

  if (verbose) {
    console.log('Outputting range ' + JSON.stringify(range));
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
    } else {
      readParts(range.start, res, range, gs, callback);

    }
  });

}

function streamFile(stats, req, callback, cookies, res) {

  var header = miscOps.corsHeader(stats.contentType);
  header.push([ 'last-modified', stats.uploadDate.toString() ]);

  var range;

  if (streamableMimes.indexOf(stats.contentType) > -1) {
    range = readRangeHeader(req.headers.range, stats.length);
    header.push([ 'Accept-Ranges', 'bytes' ]);
  }

  setExpiration(header, stats);

  setCookies(header, cookies);

  var gs = mongo.GridStore(conn, stats.filename, 'r');
  gs.open(function openedGs(error, gs) {

    if (!error) {
      if (!range) {

        header.push([ 'Content-Length', stats.length ]);
        res.writeHead(stats.metadata.status || 200, header);
        gs.stream(true).pipe(res);
        callback();

      } else {
        streamRange(range, gs, header, res, stats, callback);
      }
    } else {
      callback(error);
    }
  });

}

function shouldOutput304(lastSeen, filestats) {

  var mTimeMatches = lastSeen === filestats.uploadDate.toString();

  return mTimeMatches && !disable304 && !filestats.metadata.status;
}

// retry means it has already failed to get a page and now is trying to get the
// 404 page. It prevents infinite recursion
exports.outputFile = function(file, req, res, callback, cookies, retry) {

  if (verbose) {
    console.log('Outputting \'' + file + '\' from gridfs');

  }

  var lastSeen = req.headers ? req.headers['if-modified-since'] : null;

  files.findOne({
    filename : file
  }, {
    uploadDate : 1,
    'metadata.status' : 1,
    'metadata.type' : 1,
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

    } else if (shouldOutput304(lastSeen, fileStats)) {
      if (verbose) {
        console.log('304');

      }
      res.writeHead(304);
      res.end();
    } else {
      streamFile(fileStats, req, callback, cookies, res);
    }
  });

};