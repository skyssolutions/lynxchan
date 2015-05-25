'use strict';

// handles any action regarding user uploads
var fs = require('fs');
var imagemagick = require('imagemagick');
var gsHandler = require('./gridFsHandler');
var db = require('../db');
var threads = db.threads();
var posts = db.posts();

exports.removeFromDisk = function(path, callback) {
  fs.unlink(path, function removedFile(error) {
    if (callback) {
      callback(error);
    }
  });
};

function updatePostingFiles(boardUri, threadId, postId, files, file, callback,
    index) {

  var queryBlock = {
    boardUri : boardUri,
    threadId : threadId
  };

  var collectionToQuery = threads;

  if (postId) {
    queryBlock.postId = postId;
    collectionToQuery = posts;
  }

  collectionToQuery.update(queryBlock, {
    $push : {
      files : {
        originalName : file.title,
        path : file.path,
        thumb : file.thumbPath,
        name : file.gfsName
      }
    }
  }, function updatedPosting(error) {
    if (error) {
      callback(error);
    } else {
      exports.saveUploads(boardUri, threadId, postId, files, callback,
          index + 1);
    }

  });

}

function transferFilesToGS(boardUri, threadId, postId, files, file, callback,
    index) {

  gsHandler.saveUpload(boardUri, threadId, postId, file,
      function transferedFile(error) {

        // style exception, too simple
        exports.removeFromDisk(file.pathInDisk + '_t', function removed(
            deletionError) {
          if (error || deletionError) {
            callback(error || deletionError);
          } else {
            updatePostingFiles(boardUri, threadId, postId, files, file,
                callback, index);
          }

        });
        // style exception, too simple

      });

}

exports.saveUploads = function(boardUri, threadId, postId, files, callback,
    index) {

  index = index || 0;

  if (index < files.length) {

    var file = files[index];

    imagemagick.resize({
      srcPath : file.pathInDisk,
      dstPath : file.pathInDisk + '_t',
      width : 256,
      height : 256,
    }, function(error, stdout, stderr) {
      if (error) {
        callback(error);
      } else {

        transferFilesToGS(boardUri, threadId, postId, files, file, callback,
            index);

      }
    });

  } else {
    callback();
  }
};