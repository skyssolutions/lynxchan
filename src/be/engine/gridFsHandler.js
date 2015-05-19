'use strict';
// handles every gridfs operation.
// writing, deleting, outputting files

var db = require('../db');
var files = db.files();
var conn = db.conn();
var files = db.files();
var mongo = require('mongodb');
var boot = require('../boot');
var disable304 = boot.getGeneralSettings().disable304;
var miscOps = require('./miscOps');
var verbose = boot.getGeneralSettings().verbose;

// start of writing data
function writeDataOnOpenFile(gs, data, callback) {

  gs.write(data, function wroteData(error) {

    // style exception, the parent callback is too simple
    gs.close(function closed(closeError, result) {
      callback(error || closeError);
    });
    // style exception, the parent callback is too simple

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

exports.removeFiles = function(name, callback) {

  mongo.GridStore.unlink(conn, name, function deleted(error) {
    if (callback) {
      callback(error);
    }

  });
};

function streamFile(stats, callback, res) {

  var header = miscOps.corsHeader(stats.contentType);
  header['last-modified'] = stats.uploadDate.toString();

  res.writeHead(stats.metadata.status || 200, header);

  var gs = mongo.GridStore(conn, stats.filename, 'r');

  gs.open(function openedGs(error, gs) {

    if (!error) {
      gs.stream(true).pipe(res);

    }

    callback(error);
  });

}

function shouldOutput304(lastSeen, filestats) {

  var mTimeMatches = lastSeen === filestats.uploadDate.toString();

  return mTimeMatches && !disable304 && !filestats.metadata.status;
}

// retry means it has already failed to get a page and now is trying to get the
// 404 page. It prevents infinite recursion
exports.outputFile = function(file, req, res, callback, retry) {

  if (verbose) {
    console.log('Outputting \'' + file + '\' from gridfs');

  }

  var lastSeen = req.headers ? req.headers['if-modified-since'] : null;

  files.findOne({
    filename : file
  }, {
    uploadDate : 1,
    'metadata.status' : 1,
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
        exports.outputFile('/404.html', req, res, callback, true);
      }

    } else if (shouldOutput304(lastSeen, fileStats)) {
      if (verbose) {
        console.log('304');

      }
      res.writeHead(304);
      res.end();
    } else {
      streamFile(fileStats, callback, res);
    }
  });

};