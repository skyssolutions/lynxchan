'use strict';
// handles every gridfs operation.
// writing, deleting, outputting files

var db = require('../db');
var files = db.files();
var conn = db.conn();
var boards = db.boards();
var files = db.files();
var mongo = require('mongodb');
var settings = require('../boot').getGeneralSettings();
var disable304 = settings.disable304;
var verbose = settings.verbose;
var miscOps = require('./miscOps');

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
    console.log('Writing file on gridfs under \'' + destination + '\'');
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

// start of saving upload
function transferMediaToGfs(boardUri, threadId, postId, fileId, file, cb,
    extension) {

  var fileName = fileId + '.' + extension;
  fileName = '/' + boardUri + '/media/' + fileName;

  var meta = {
    boardUri : boardUri,
    threadId : threadId,
    type : 'media'
  };

  if (postId) {
    meta.postId = postId;
  }

  file.path = fileName;
  file.gfsName = fileId + '.' + extension;

  exports.writeFile(file.pathInDisk, fileName, file.mime, meta, cb);

}

function transferThumbToGfs(boardUri, threadId, postId, fileId, file, cb) {

  var parts = file.title.split('.');

  var meta = {
    boardUri : boardUri,
    threadId : threadId,
    type : 'media'
  };

  if (postId) {
    meta.postId = postId;
  }

  if (parts.length) {
    var ext = parts[parts.length - 1].toLowerCase();

    var thumbName = 't_' + fileId + '.' + ext;
    thumbName = '/' + boardUri + '/media/' + thumbName;

    file.thumbPath = thumbName;

    exports.writeFile(file.pathInDisk + '_t', thumbName, file.mime, meta,
        function wroteTbToGfs(error) {
          if (error) {
            cb(error);
          } else {
            transferMediaToGfs(boardUri, threadId, postId, fileId, file, cb,
                ext);
          }

        });

  } else {
    cb('Unknown extension');
  }

}

exports.saveUpload = function(boardUri, threadId, postId, file, callback) {

  boards.findOneAndUpdate({
    boardUri : boardUri
  }, {
    $inc : {
      lastFileId : 1
    }
  }, {
    returnOriginal : false
  }, function incrementedFileId(error, result) {
    if (error) {
      callback(error);
    } else {
      transferThumbToGfs(boardUri, threadId, postId, result.value.lastFileId,
          file, callback);
    }
  });

};
// end of saving upload

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