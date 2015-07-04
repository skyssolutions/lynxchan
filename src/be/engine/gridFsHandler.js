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
var boot = require('../boot');
var genericThumb = boot.genericThumb();
var spoilerPath = boot.spoilerImage();
var permanentTypes = [ 'media', 'preview' ];

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

// start of saving upload
// TODO transfer the logic to upload handler
function transferMediaToGfs(boardUri, threadId, postId, fileId, file, cb,
    extension, meta) {

  var fileName = fileId + '.' + extension;
  fileName = '/' + boardUri + '/media/' + fileName;

  file.path = fileName;
  file.gfsName = fileId + '.' + extension;

  exports.writeFile(file.pathInDisk, fileName, file.mime, meta,
      function wroteFile(error) {
        if (error) {
          cb(error);
        } else {

          // style exception, too simple

          files.findOne({
            filename : fileName
          }, function gotFile(error, foundFile) {
            if (error) {
              cb(error);
            } else {
              file.md5 = foundFile.md5;
              cb();
            }
          });

          // style exception, too simple

        }

      });

}

function transferThumbToGfs(boardUri, threadId, postId, fileId, file, cb,
    spoiler) {

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

    if (file.mime.indexOf('image/') !== -1 && !spoiler) {
      var thumbName = '/' + boardUri + '/media/' + 't_' + fileId + '.' + ext;

      file.thumbPath = thumbName;

      exports.writeFile(file.pathInDisk + '_t', thumbName, file.mime, meta,
          function wroteTbToGfs(error) {
            if (error) {
              cb(error);
            } else {
              transferMediaToGfs(boardUri, threadId, postId, fileId, file, cb,
                  ext, meta);
            }

          });
    } else {

      file.thumbPath = spoiler ? spoilerPath : genericThumb;

      transferMediaToGfs(boardUri, threadId, postId, fileId, file, cb, ext,
          meta);
    }

  } else {
    cb('Unknown extension');
  }

}

exports.saveUpload = function(boardUri, threadId, postId, file, callback,
    spoiler) {

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
          file, callback, spoiler);
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

function setExpiration(header, stats) {
  var expiration = new Date();

  if (permanentTypes.indexOf(stats.metadata.type) > -1) {
    expiration.setFullYear(expiration.getFullYear() + 1);
  }

  header.push([ 'expires', expiration.toString() ]);
}

function streamFile(stats, callback, cookies, res) {

  var header = miscOps.corsHeader(stats.contentType);
  header.push([ 'last-modified', stats.uploadDate.toString() ]);

  setExpiration(header, stats);

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
      streamFile(fileStats, callback, cookies, res);
    }
  });

};