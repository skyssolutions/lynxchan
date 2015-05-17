'use strict';
// handles every gridfs operation.
// writing, deleting, outputting files

var db = require('../db');
var files = db.files();
var conn = db.conn();
var files = db.files();
var mongo = require('mongodb');
var disable304 = require('../boot').getGeneralSettings().disable304;
var miscOps = require('./miscOps');

// start of writing data
function writeDataOnOpenFile(gs, data, callback) {

  gs.write(data, function wroteData(error) {

    gs.close();

    callback(error);
  });

}

exports.writeData = function(data, destination, mime, meta, callback) {

  var gs = mongo.GridStore(conn, destination, 'w', {
    'content_type' : mime,
    metadata : meta
  });

  exports.removeFiles(destination, function clearedFile(error) {
    if (error) {
      callback(error);
    } else {

      gs.open(function openedGs(error, gs) {

        if (error) {
          callback(error);
        } else {
          writeDataOnOpenFile(gs, data, callback);
        }
      });

    }
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

  res.writeHead(200, header);

  var gs = mongo.GridStore(conn, stats.filename, 'r');

  gs.open(function openedGs(error, gs) {

    if (!error) {
      gs.stream(true).pipe(res);

    }

    callback(error);
  });

}

exports.outputFile = function(file, req, res, callback) {

  var lastSeen = req.headers ? req.headers['if-modified-since'] : null;

  files.findOne({
    filename : file
  }, {
    uploadDate : 1,
    contentType : 1,
    filename : 1,
    _id : 0
  }, function gotFile(error, fileStats) {
    if (error) {
      callback(error);
    } else if (!fileStats) {
      callback({
        code : 'ENOENT'
      });
    } else if (lastSeen === fileStats.uploadDate.toString() && !disable304) {
      res.writeHead(304);
      res.end();
    } else {
      streamFile(fileStats, callback, res);
    }
  });

};