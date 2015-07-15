'use strict';

// handles any action regarding user uploads
var fs = require('fs');
var im = require('gm').subClass({
  imageMagick : true
});
var gsHandler = require('./gridFsHandler');
var db = require('../db');
var hashBans = db.hashBans();
var threads = db.threads();
var exec = require('child_process').exec;
var posts = db.posts();
var settings = require('../boot').getGeneralSettings();

var webmLengthCommand = 'ffprobe -v error -show_entries stream=width,height ';
var webmThumbCommand = 'ffmpeg -i {$path} -vframes 1 -vf scale=';

var supportedMimes = settings.acceptedMimes;

if (!supportedMimes) {
  supportedMimes = [ 'image/png', 'image/jpeg', 'image/gif', 'image/bmp',
      'video/webm' ];
}

exports.supportedMimes = function() {
  return supportedMimes;
};

exports.getImageBounds = function(path, callback) {

  im(path).identify(function(error, stats) {

    if (!error) {
      callback(null, stats.size.width, stats.size.height);
    } else {
      callback(error);
    }

  });

};

exports.getWebmBounds = function(path, callback) {

  exec(webmLengthCommand + path, function gotDimensions(error, output) {

    if (error) {
      callback(error);
    } else {

      var matches = output.match(/width\=(\d+)\nheight\=(\d+)/);
      callback(null, matches[1], matches[2]);

    }
  });

};

exports.removeFromDisk = function(path, callback) {
  fs.unlink(path, function removedFile(error) {
    if (callback) {
      callback(error);
    }
  });
};

function updatePostingFiles(boardUri, threadId, postId, files, file, callback,
    index, spoiler, updatedFileCount) {

  if (postId && !updatedFileCount) {
    threads.updateOne({
      threadId : threadId,
      boardUri : boardUri
    }, {
      $inc : {
        fileCount : 1
      }
    }, function updatedFileCount(error) {
      if (error) {
        callback(error);
      } else {
        updatePostingFiles(boardUri, threadId, postId, files, file, callback,
            index, spoiler, updatedFileCount, true);
      }
    });

    return;
  }

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
        name : file.gfsName,
        size : file.size,
        md5 : file.md5,
        width : file.width,
        height : file.height
      }
    }
  }, function updatedPosting(error) {
    if (error) {
      callback(error);
    } else {
      exports.saveUploads(boardUri, threadId, postId, files, spoiler, callback,
          index + 1);
    }

  });

}

function cleanThumbNail(boardUri, threadId, postId, files, file, callback,
    index, saveError, spoiler) {

  var image = file.mime.indexOf('image/') !== -1;
  var webm = file.mime === 'video/webm' && settings.webmThumb;

  if ((image || webm) && !spoiler) {

    exports.removeFromDisk(file.pathInDisk + (webm ? '_.png' : '_t'),
        function removed(deletionError) {
          if (saveError || deletionError) {
            callback(saveError || deletionError);
          } else {
            updatePostingFiles(boardUri, threadId, postId, files, file,
                callback, index, spoiler);
          }

        });
  } else {

    if (saveError) {
      callback(saveError);
    } else {
      updatePostingFiles(boardUri, threadId, postId, files, file, callback,
          index, spoiler);
    }
  }
}

function transferFilesToGS(boardUri, threadId, postId, files, file, callback,
    index, spoiler) {

  gsHandler.saveUpload(boardUri, threadId, postId, file,
      function transferedFile(error) {

        cleanThumbNail(boardUri, threadId, postId, files, file, callback,
            index, error, spoiler);
      }, spoiler);
}

function checkForHashBan(boardUri, md5, callback) {

  hashBans.count({
    md5 : md5,
    $or : [ {
      boardUri : {
        $exists : false
      }
    }, {
      boardUri : boardUri
    } ]
  }, callback);

}

function processFile(boardUri, threadId, postId, files, file, spoiler,
    callback, index) {

  if (file.mime.indexOf('image/') !== -1 && !spoiler) {

    im(file.pathInDisk).resize(128, 128).noProfile().write(
        file.pathInDisk + '_t',
        function(error) {
          if (error) {
            callback(error);
          } else {
            transferFilesToGS(boardUri, threadId, postId, files, file,
                callback, index, spoiler);

          }
        });
  } else if (file.mime === 'video/webm' && settings.webmThumb) {

    var command = webmThumbCommand.replace('{$path}', file.pathInDisk);

    if (file.width > file.height) {
      command += '128:-1';
    } else {
      command += '-1:128';
    }

    command += ' ' + file.pathInDisk + '_.png';

    exec(command, function createdThumb(error) {
      if (error) {
        callback(error);
      } else {
        transferFilesToGS(boardUri, threadId, postId, files, file, callback,
            index, spoiler);
      }
    });

  } else {
    transferFilesToGS(boardUri, threadId, postId, files, file, callback, index,
        spoiler);
  }

}

exports.saveUploads = function(boardUri, threadId, postId, files, spoiler,
    callback, index) {

  index = index || 0;

  if (index < files.length) {

    var file = files[index];

    checkForHashBan(boardUri, file.md5, function isBanned(error, banned) {
      if (error) {
        callback(error);
      } else if (banned) {
        exports.saveUploads(boardUri, threadId, postId, files, spoiler,
            callback, index + 1);
      } else {
        processFile(boardUri, threadId, postId, files, file, spoiler, callback,
            index);
      }
    });

  } else {
    callback();
  }
};