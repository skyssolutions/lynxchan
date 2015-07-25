'use strict';

// handles any action regarding user uploads
var fs = require('fs');
var im = require('gm').subClass({
  imageMagick : true
});
var gsHandler = require('./gridFsHandler');
var db = require('../db');
var files = db.files();
var hashBans = db.hashBans();
var threads = db.threads();
var boards = db.boards();
var lang = require('./langOps').languagePack();
var exec = require('child_process').exec;
var boot = require('../boot');
var genericThumb = boot.genericThumb();
var spoilerPath = boot.spoilerImage();
var posts = db.posts();
var settings = require('../boot').getGeneralSettings();
var webmLengthCommand = 'ffprobe -v error -show_entries stream=width,height ';
var webmThumbCommand = 'ffmpeg -i {$path} -vframes 1 -vf scale=';
var supportedMimes = settings.acceptedMimes;
var thumbSize = settings.thumbSize || 128;
if (!supportedMimes) {
  supportedMimes = [ 'image/png', 'image/jpeg', 'image/gif', 'image/bmp',
      'video/webm', 'audio/mpeg', 'video/mp4', 'video/ogg', 'audio/ogg',
      'audio/webm' ];
}

var correctedMimesRelation = {
  'video/webm' : 'audio/webm',
  'video/ogg' : 'audio/ogg'
};

var videoMimes = [ 'video/webm', 'video/mp4', 'video/ogg' ];

exports.videoMimes = function() {
  return videoMimes;
};

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

exports.getVideoBounds = function(file, callback) {

  var path = file.pathInDisk;

  exec(webmLengthCommand + path, function gotDimensions(error, output) {

    if (error) {
      callback(error);
    } else {

      var matches = output.match(/width\=(\d+)\nheight\=(\d+)/);

      if (!matches) {
        var correctedMime = correctedMimesRelation[file.mime];

        if (!correctedMime) {
          callback('Unable to get dimensions for file.');
        } else {
          file.mime = correctedMime;
          callback(null, null, null);
        }
      } else {
        callback(null, +matches[1], +matches[2]);
      }

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

// start of upload saving process
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
        mime : file.mime,
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
    index, saveError, spoiler, tooSmall) {

  var image = file.mime.indexOf('image/') !== -1;
  var video = videoMimes.indexOf(file.mime) > -1 && settings.videoThumb;

  if ((image || video) && !spoiler && !tooSmall) {

    exports.removeFromDisk(file.pathInDisk + (video ? '_.png' : '_t'),
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

function transferMediaToGfs(boardUri, threadId, postId, fileId, file, cb,
    extension, meta, tooSmall) {

  var fileName = fileId + '.' + extension;
  fileName = '/' + boardUri + '/media/' + fileName;

  if (tooSmall) {
    file.thumbPath = fileName;
  }

  file.path = fileName;
  file.gfsName = fileId + '.' + extension;

  gsHandler.writeFile(file.pathInDisk, fileName, file.mime, meta,
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

function processThumb(boardUri, fileId, ext, file, video, meta, cb, threadId,
    postId) {
  var thumbName = '/' + boardUri + '/media/' + 't_' + fileId + '.' + ext;

  file.thumbPath = thumbName;

  gsHandler.writeFile(file.pathInDisk + (video ? '_.png' : '_t'), thumbName,
      file.mime, meta, function wroteTbToGfs(error) {
        if (error) {
          cb(error);
        } else {
          transferMediaToGfs(boardUri, threadId, postId, fileId, file, cb, ext,
              meta);
        }

      });
}

function transferThumbToGfs(boardUri, threadId, postId, fileId, file, cb,
    spoiler, tooSmall) {

  var parts = file.title.split('.');

  var meta = {
    boardUri : boardUri,
    threadId : threadId,
    type : 'media'
  };

  if (postId) {
    meta.postId = postId;
  }

  if (parts.length > 1) {

    var ext = parts[parts.length - 1].toLowerCase();

    var image = file.mime.indexOf('image/') !== -1;
    var video = videoMimes.indexOf(file.mime) > -1 && settings.videoThumb;

    if ((image || video) && !spoiler) {
      if (tooSmall) {
        transferMediaToGfs(boardUri, threadId, postId, fileId, file, cb, ext,
            meta, tooSmall);
      } else {

        processThumb(boardUri, fileId, ext, file, video, meta, cb, threadId,
            postId);
      }
    } else {

      file.thumbPath = spoiler ? spoilerPath : genericThumb;

      transferMediaToGfs(boardUri, threadId, postId, fileId, file, cb, ext,
          meta);
    }

  } else {
    cb(lang.errUnknownExtension);
  }

}

function saveUpload(boardUri, threadId, postId, file, callback, spoiler,
    tooSmall) {

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
          file, callback, spoiler, tooSmall);
    }
  });

}

function transferFilesToGS(boardUri, threadId, postId, files, file, callback,
    index, spoiler, tooSmall) {

  saveUpload(boardUri, threadId, postId, file, function transferedFile(error) {

    cleanThumbNail(boardUri, threadId, postId, files, file, callback, index,
        error, spoiler, tooSmall);
  }, spoiler, tooSmall);
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

  var tooSmall = file.height <= thumbSize && file.width <= thumbSize;

  if (file.mime.indexOf('image/') !== -1 && !spoiler && !tooSmall) {

    im(file.pathInDisk).resize(thumbSize, thumbSize).noProfile().write(
        file.pathInDisk + '_t',
        function(error) {
          if (error) {
            callback(error);
          } else {
            transferFilesToGS(boardUri, threadId, postId, files, file,
                callback, index, spoiler);

          }
        });
  } else if (videoMimes.indexOf(file.mime) > -1 && settings.videoThumb) {

    var command = webmThumbCommand.replace('{$path}', file.pathInDisk);

    if (tooSmall) {
      command += '-1:-1';
    } else if (file.width > file.height) {
      command += thumbSize + ':-1';
    } else {
      command += '-1:' + thumbSize;
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
        spoiler, tooSmall);
  }

}

exports.saveUploads = function(boardUri, threadId, postId, files, spoiler,
    callback, index) {

  index = index || 0;

  if (index < files.length) {

    var file = files[index];

    if (supportedMimes.indexOf(file.mime) > -1) {
      checkForHashBan(boardUri, file.md5, function isBanned(error, banned) {
        if (error) {
          callback(error);
        } else if (banned) {
          exports.saveUploads(boardUri, threadId, postId, files, spoiler,
              callback, index + 1);
        } else {
          processFile(boardUri, threadId, postId, files, file, spoiler,
              callback, index);
        }
      });
    } else {
      exports.saveUploads(boardUri, threadId, postId, files, spoiler, callback,
          index + 1);
    }

  } else {
    callback();
  }
};
// end of upload saving process
