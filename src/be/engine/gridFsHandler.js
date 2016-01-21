'use strict';

// handles every gridfs operation.

var db = require('../db');
var archiveHandler = require('../archive');
var files = db.files();
var conn = db.conn();
var mongo = require('mongodb');
var disable304;
var verbose;
var noDaemon = require('../kernel').noDaemon();
var miscOps;

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
exports.writeDataOnOpenFile = function(gs, data, callback, archive, meta, mime,
    destination) {

  if (typeof (data) === 'string') {
    data = new Buffer(data, 'utf-8');
  }

  gs.write(data, true, function wroteData(error) {

    if (error || !archive || noDaemon) {
      callback(error);
    } else {
      archiveHandler.archiveData(data, destination, mime, meta, callback);
    }

  });

};

exports.writeData = function(data, dest, mime, meta, callback, archive) {

  meta.lastModified = new Date();

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
      exports
          .writeDataOnOpenFile(gs, data, callback, archive, meta, mime, dest);
    }
  });

};
// end of writing data

// start of transferring file to gridfs
exports.writeFileOnOpenFile = function(gs, path, callback, archive,
    destination, meta, mime) {
  gs.writeFile(path, function wroteFile(error) {

    // style exception, too simple
    gs.close(function closed(closeError, result) {
      if (!archive || error || noDaemon) {
        callback(error || closeError);
      } else {
        archiveHandler.writeFile(path, destination, mime, meta, callback);
      }

    });
    // style exception, too simple

  });
};

exports.writeFile = function(path, dest, mime, meta, callback, archive) {

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
      exports
          .writeFileOnOpenFile(gs, path, callback, archive, dest, meta, mime);
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

  header.push([ 'expires', expiration.toString() ]);
};

exports.setCookies = function(header, cookies) {
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
  header.push([ 'last-modified', lastM.toString() ]);

  exports.setExpiration(header, stats);

  exports.setCookies(header, cookies);

  return header;
};

exports.streamFile = function(stats, req, callback, cookies, res, optCon) {

  var header = exports.getHeader(stats, req, cookies);

  var range;

  if (streamableMimes.indexOf(stats.contentType) > -1) {
    range = exports.readRangeHeader(req.headers.range, stats.length);
    header.push([ 'Accept-Ranges', 'bytes' ]);
  }

  var gs = mongo.GridStore(optCon || conn, stats.filename, 'r');

  gs.open(function openedGs(error, gs) {

    if (!error) {
      if (!range) {

        header.push([ 'Content-Length', stats.length ]);
        res.writeHead(stats.metadata.status || 200, header);

        var stream = gs.stream();

        stream.on('data', function(chunk) {
          res.write(chunk);
        });

        stream.on('error', function(error) {
          callback(error);
          gs.close();
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

  var mTimeMatches = lastSeen === lastM.toString();

  return mTimeMatches && !disable304 && !stats.metadata.status;
};

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
    'metadata.lastModified' : 1,
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

    } else if (exports.shouldOutput304(lastSeen, fileStats)) {
      if (verbose) {
        console.log('304');

      }
      res.writeHead(304);
      res.end();
    } else {
      exports.streamFile(fileStats, req, callback, cookies, res);
    }
  });

};
// end of outputting file
