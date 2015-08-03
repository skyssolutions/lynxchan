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
var boards = db.boards();
var lang = require('./langOps').languagePack();
var exec = require('child_process').exec;
var boot = require('../boot');
var genericThumb = boot.genericThumb();
var genericAudioThumb = boot.genericAudioThumb();
var spoilerPath = boot.spoilerImage();
var posts = db.posts();
var settings = require('../boot').getGeneralSettings();
var videoDimensionsCommand = 'ffprobe -v error -show_entries ';
videoDimensionsCommand += 'stream=width,height ';
var videoThumbCommand = 'ffmpeg -i {$path} -y -vframes 1 -vf scale=';
var mp3ThumbCommand = 'ffmpeg -i {$path} -y -an -vcodec copy {$destination}';
mp3ThumbCommand += ' && mogrify -resize {$dimension} {$destination}';
var archive = settings.archiveLevel > 1;

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

var thumbAudioMimes = [ 'audio/mpeg', 'audio/ogg' ];

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

// side-effect: might change the file mime.
exports.getVideoBounds = function(file, callback) {

  var path = file.pathInDisk;

  exec(videoDimensionsCommand + path, function gotDimensions(error, output) {

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
function updatePostingFiles(boardUri, threadId, postId, files, file,
    allowsArchive, callback, index, spoiler, updatedFileCount) {

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
        updatePostingFiles(boardUri, threadId, postId, files, file,
            allowsArchive, callback, index, spoiler, updatedFileCount, true);
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
      exports.saveUploads(boardUri, threadId, postId, files, spoiler,
          allowsArchive, callback, index + 1);
    }

  });

}

function cleanThumbNail(boardUri, threadId, postId, files, file, allowsArchive,
    callback, index, saveError, spoiler) {

  if (file.thumbOnDisk) {

    exports.removeFromDisk(file.thumbOnDisk, function removed(deletionError) {
      if (saveError || deletionError) {
        callback(saveError || deletionError);
      } else {
        updatePostingFiles(boardUri, threadId, postId, files, file,
            allowsArchive, callback, index, spoiler);
      }

    });
  } else {

    if (saveError) {
      callback(saveError);
    } else {
      updatePostingFiles(boardUri, threadId, postId, files, file,
          allowsArchive, callback, index, spoiler);
    }
  }
}

function transferMediaToGfs(boardUri, threadId, postId, fileId, file,
    allowsArchive, cb, extension, meta) {

  var fileName = fileId + '.' + extension;
  fileName = '/' + boardUri + '/media/' + fileName;

  file.path = fileName;
  file.gfsName = fileId + '.' + extension;

  gsHandler.writeFile(file.pathInDisk, fileName, file.mime, meta,
      function wroteFile(error) {
        cb(error);
      }, archive && allowsArchive);

}

function processThumb(boardUri, fileId, ext, file, meta, allowsArchive, cb,
    threadId, postId) {
  var thumbName = '/' + boardUri + '/media/' + 't_' + fileId + '.' + ext;

  file.thumbPath = thumbName;

  gsHandler.writeFile(file.thumbOnDisk, thumbName, file.thumbMime, meta,
      function wroteTbToGfs(error) {
        if (error) {
          cb(error);
        } else {
          transferMediaToGfs(boardUri, threadId, postId, fileId, file,
              allowsArchive, cb, ext, meta);
        }

      }, archive && allowsArchive);
}

function useGenericThumb(audioMime, file, boardUri, threadId, postId, fileId,
    allowsArchive, cb, ext, meta, spoiler) {

  var genericToUse = audioMime ? genericAudioThumb : genericThumb;

  file.thumbPath = spoiler ? spoilerPath : genericToUse;

  transferMediaToGfs(boardUri, threadId, postId, fileId, file, allowsArchive,
      cb, ext, meta);
}

function transferThumbToGfs(boardUri, threadId, postId, fileId, file,
    allowsArchive, cb) {

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

    if (file.thumbOnDisk) {

      processThumb(boardUri, fileId, ext, file, meta, allowsArchive, cb,
          threadId, postId);

    } else {
      transferMediaToGfs(boardUri, threadId, postId, fileId, file,
          allowsArchive, cb, ext, meta);
    }

  } else {
    cb(lang.errUnknownExtension);
  }

}

function saveUpload(boardUri, threadId, postId, file, allowsArchive, callback) {

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
          file, allowsArchive, callback);
    }
  });

}

function transferFilesToGS(boardUri, threadId, postId, files, file,
    allowsArchive, callback, index, spoiler) {

  saveUpload(boardUri, threadId, postId, file, allowsArchive,
      function transferedFile(error) {

        cleanThumbNail(boardUri, threadId, postId, files, file, allowsArchive,
            callback, index, error, spoiler);
      });
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

function generateVideoThumb(file, files, tooSmall, index, threadId, boardUri,
    postId, allowsArchive, callback, spoiler) {

  var command = videoThumbCommand.replace('{$path}', file.pathInDisk);

  var thumbDestination = file.pathInDisk + '_.png';

  if (tooSmall) {
    command += '-1:-1';
  } else if (file.width > file.height) {
    command += thumbSize + ':-1';
  } else {
    command += '-1:' + thumbSize;
  }

  command += ' ' + thumbDestination;

  file.thumbMime = 'image/png';
  file.thumbOnDisk = thumbDestination;

  exec(command, function createdThumb(error) {
    if (error) {
      callback(error);
    } else {
      transferFilesToGS(boardUri, threadId, postId, files, file, allowsArchive,
          callback, index, spoiler);
    }
  });

}

function generateAudioThumb(file, files, boardUri, threadId, postId,
    allowsArchive, callback, index, spoiler) {

  var thumbDestination = file.pathInDisk + '_.png';

  var mp3Command = mp3ThumbCommand.replace('{$path}', file.pathInDisk).replace(
      /\{\$destination\}/g, thumbDestination).replace('{$dimension}',
      thumbSize + 'x' + thumbSize);

  exec(mp3Command, function createdThumb(error) {

    if (error) {
      file.thumbPath = genericAudioThumb;
    } else {
      file.thumbOnDisk = thumbDestination;
      file.thumbMime = 'image/png';
    }

    transferFilesToGS(boardUri, threadId, postId, files, file, allowsArchive,
        callback, index, spoiler);

  });

}

function processFile(boardUri, threadId, postId, files, file, spoiler,
    allowsArchive, callback, index) {

  var tooSmall = file.height <= thumbSize && file.width <= thumbSize;

  if (spoiler) {

    file.thumbPath = spoilerPath;

    transferFilesToGS(boardUri, threadId, postId, files, file, callback, index,
        spoiler);

  } else if (file.mime.indexOf('image/') !== -1 && !tooSmall) {

    var thumbDestination = file.pathInDisk + '_t';

    file.thumbOnDisk = thumbDestination;
    file.thumbMime = file.mime;

    im(file.pathInDisk).resize(thumbSize, thumbSize).noProfile().write(
        thumbDestination,
        function(error) {
          if (error) {
            callback(error);
          } else {
            transferFilesToGS(boardUri, threadId, postId, files, file,
                allowsArchive, callback, index, spoiler);

          }
        });

  } else if (videoMimes.indexOf(file.mime) > -1 && settings.mediaThumb) {

    generateVideoThumb(file, files, tooSmall, index, threadId, boardUri,
        postId, allowsArchive, callback, spoiler);

  } else if (thumbAudioMimes.indexOf(file.mime) > -1 && settings.mediaThumb) {

    generateAudioThumb(file, files, boardUri, threadId, postId, allowsArchive,
        callback, index, spoiler);

  } else {

    if (thumbAudioMimes.indexOf(file.mime) > -1) {
      file.thumbPath = genericAudioThumb;
    } else {
      file.thumbPath = genericThumb;
    }

    transferFilesToGS(boardUri, threadId, postId, files, file, allowsArchive,
        callback, index, spoiler);

  }

}

exports.saveUploads = function(boardUri, threadId, postId, files, spoiler,
    allowsArchive, callback, index) {

  index = index || 0;

  if (index < files.length) {

    var file = files[index];

    checkForHashBan(boardUri, file.md5, function isBanned(error, banned) {
      if (error) {
        callback(error);
      } else if (banned) {
        exports.saveUploads(boardUri, threadId, postId, files, spoiler,
            allowsArchive, callback, index + 1);
      } else {
        processFile(boardUri, threadId, postId, files, file, spoiler,
            allowsArchive, callback, index);
      }
    });

  } else {
    callback();
  }
};
// end of upload saving process
