'use strict';

// handles any action regarding user uploads on posting

var fs = require('fs');
var db = require('../db');
var threads = db.threads();
var boards = db.boards();
var exec = require('child_process').exec;
var kernel = require('../kernel');
var genericThumb = kernel.genericThumb();
var genericAudioThumb = kernel.genericAudioThumb();
var spoilerPath = kernel.spoilerImage();
var globalLatestImages = db.latestImages();
var posts = db.posts();
var videoDimensionsCommand = 'ffprobe -v error -show_entries ';
videoDimensionsCommand += 'stream=width,height ';
var videoThumbCommand = 'ffmpeg -i {$path} -y -vframes 1 -vf scale=';
var mp3ThumbCommand = 'ffmpeg -i {$path} -y -an -vcodec copy {$destination}';
mp3ThumbCommand += ' && mogrify -resize {$dimension} {$destination}';
var settings = require('../settingsHandler').getGeneralSettings();
var archive = settings.archiveLevel > 1;
var supportedMimes = settings.acceptedMimes;
var thumbSize = settings.thumbSize;
var latestImages = settings.globalLatestImages;
var miscOps;
var lang;
var gsHandler;

var correctedMimesRelation = {
  'video/webm' : 'audio/webm',
  'video/ogg' : 'audio/ogg'
};

var thumbAudioMimes = [ 'audio/mpeg', 'audio/ogg' ];

var videoMimes = [ 'video/webm', 'video/mp4', 'video/ogg' ];

exports.loadDependencies = function() {

  miscOps = require('./miscOps');
  lang = require('./langOps').languagePack();
  gsHandler = require('./gridFsHandler');

};

exports.videoMimes = function() {
  return videoMimes;
};

exports.supportedMimes = function() {
  return supportedMimes;
};

exports.getImageBounds = function(file, callback) {

  var path = file.pathInDisk;

  exec('identify ' + path, function(error, results) {
    if (error) {
      callback(error);
    } else {
      var lines = results.split('\n');

      var maxHeight = 0;
      var maxWidth = 0;

      for (var i = 0; i < lines.length; i++) {
        var dimensions = lines[i].match(/\s(\d+)x(\d+)\s/);

        if (dimensions) {

          var currentWidth = +dimensions[1];
          var currentHeight = +dimensions[2];

          maxWidth = currentWidth > maxWidth ? currentWidth : maxWidth;
          maxHeight = currentHeight > maxHeight ? currentHeight : maxHeight;

        }
      }

      callback(null, maxWidth, maxHeight);
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
exports.cleanLatestImages = function(boardData, threadId, postId, file,
    callback) {

  globalLatestImages.aggregate([ {
    $sort : {
      creation : -1
    }
  }, {
    $skip : latestImages
  }, {
    $group : {
      _id : 0,
      ids : {
        $push : '$_id'
      }
    }
  } ], function gotLatestPostsToClean(error, results) {

    if (error) {
      callback(error);
    } else if (!results.length) {

      exports.updatePostingFiles(boardData, threadId, postId, file, callback,
          false, true);

    } else {

      // style exception, too simple
      globalLatestImages.removeMany({
        _id : {
          $in : results[0].ids
        }
      }, function removedOldImages(error) {

        if (error) {
          callback(error);
        } else {
          exports.updatePostingFiles(boardData, threadId, postId, file,
              callback, false, true);
        }
      });
      // style exception, too simple

    }

  });

};

exports.updateLatestImages = function(boardData, threadId, postId, file,
    callback) {

  var toInsert = {
    threadId : threadId,
    creation : new Date(),
    boardUri : boardData.boardUri,
    thumb : file.thumbPath
  };

  if (postId) {
    toInsert.postId = postId;
  }

  globalLatestImages.insertOne(toInsert, function insertedLatestImage(error) {
    if (error) {
      callback(error);
    } else {

      // style exception, too simple
      globalLatestImages.count(function counted(error, count) {

        if (error) {
          callback(error);
        } else if (count <= latestImages) {
          exports.updatePostingFiles(boardData, threadId, postId, file,
              callback, false, true);
        } else {
          exports
              .cleanLatestImages(boardData, threadId, postId, file, callback);
        }

      });
      // style exception, too simple

    }

  });

};

exports.updateFileCount = function(threadId, boardData, cb, postId, file) {

  threads.updateOne({
    threadId : threadId,
    boardUri : boardData.boardUri
  }, {
    $inc : {
      fileCount : 1
    }
  }, function updatedFileCount(error) {
    if (error) {
      cb(error);
    } else {
      exports.updatePostingFiles(boardData, threadId, postId, file, cb, true,
          true);
    }
  });

};

exports.updatePostingFiles = function(boardData, threadId, postId, file,
    callback, updatedFileCount, updatedLatestImages) {

  var image = file.mime.indexOf('image/') > -1;

  // add image to latest images before proceeding
  if (latestImages && !updatedLatestImages && image) {

    exports.updateLatestImages(boardData, threadId, postId, file, callback);

    return;
  }

  // updates thread's file count before proceeding
  if (postId && !updatedFileCount) {

    exports.updateFileCount(threadId, boardData, callback, postId, file);

    return;
  }

  var queryBlock = {
    boardUri : boardData.boardUri,
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
        originalName : file.title.replace(/[<>]/g, function replace(match) {
          return miscOps.htmlReplaceTable[match];
        }),
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
  }, callback);

};

exports.cleanThumbNail = function(boardData, threadId, postId, file, saveError,
    cb) {

  if (file.thumbOnDisk) {

    exports.removeFromDisk(file.thumbOnDisk, function removed(deletionError) {
      if (saveError || deletionError) {
        cb(saveError || deletionError);
      } else {
        exports.updatePostingFiles(boardData, threadId, postId, file, cb);
      }

    });
  } else {

    if (saveError) {
      cb(saveError);
    } else {
      exports.updatePostingFiles(boardData, threadId, postId, file, cb);
    }
  }
};

exports.transferMediaToGfs = function(boardData, threadId, postId, fileId,
    file, extension, meta, cb) {

  var fileName = fileId + '.' + extension;
  fileName = '/' + boardData.boardUri + '/media/' + fileName;

  if (!file.thumbPath) {
    file.thumbPath = fileName;
  }

  file.path = fileName;
  file.gfsName = fileId + '.' + extension;

  var allowsArchive;

  if (boardData.settings) {
    allowsArchive = boardData.settings.indexOf('archive') > -1;
  }

  var archiveMedia = allowsArchive && archive;

  gsHandler.writeFile(file.pathInDisk, fileName, file.mime, meta, cb,
      archiveMedia);

};

exports.processThumb = function(boardData, threadId, postId, fileId, ext, file,
    meta, callback) {
  var thumbName = '/' + boardData.boardUri + '/media/' + 't_' + fileId;
  thumbName += '.' + (settings.thumbExtension || ext);

  file.thumbPath = thumbName;

  var allowsArchive;

  if (boardData.settings) {
    allowsArchive = boardData.settings.indexOf('archive') > -1;
  }

  gsHandler.writeFile(file.thumbOnDisk, thumbName, file.thumbMime, meta,
      function wroteTbToGfs(error) {
        if (error) {
          callback(error);
        } else {
          exports.transferMediaToGfs(boardData, threadId, postId, fileId, file,
              ext, meta, callback);
        }

      }, archive && allowsArchive);
};

exports.transferThumbToGfs = function(boardData, threadId, postId, fileId,
    file, cb) {

  var parts = file.title.split('.');

  var meta = {
    boardUri : boardData.boardUri,
    threadId : threadId,
    type : 'media'
  };

  if (postId) {
    meta.postId = postId;
  }

  if (parts.length > 1) {

    var ext = parts[parts.length - 1].toLowerCase().replace(/\W/g, '');

    if (file.thumbOnDisk) {

      exports.processThumb(boardData, threadId, postId, fileId, ext, file,
          meta, cb);

    } else {
      exports.transferMediaToGfs(boardData, threadId, postId, fileId, file,
          ext, meta, cb);
    }

  } else {
    cb(lang.errUnknownExtension);
  }

};

exports.saveUpload = function(boardData, threadId, postId, file, callback) {

  boards.findOneAndUpdate({
    boardUri : boardData.boardUri
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
      exports.transferThumbToGfs(boardData, threadId, postId,
          result.value.lastFileId, file, callback);
    }
  });

};

exports.transferFilesToGS = function(boardData, threadId, postId, file,
    callback) {

  exports.saveUpload(boardData, threadId, postId, file,
      function transferedFile(error) {

        exports.cleanThumbNail(boardData, threadId, postId, file, error,
            callback);
      });
};

exports.generateVideoThumb = function(boardData, threadId, postId, file,
    tooSmall, callback) {

  var command = videoThumbCommand.replace('{$path}', file.pathInDisk);

  var extensionToUse = settings.thumbExtension || 'png';

  var thumbDestination = file.pathInDisk + '_.' + extensionToUse;

  if (tooSmall) {
    command += '-1:-1';
  } else if (file.width > file.height) {
    command += thumbSize + ':-1';
  } else {
    command += '-1:' + thumbSize;
  }

  command += ' ' + thumbDestination;

  file.thumbMime = miscOps.getMime(thumbDestination);
  file.thumbOnDisk = thumbDestination;

  exec(command, function createdThumb(error) {
    if (error) {
      callback(error);
    } else {
      exports.transferFilesToGS(boardData, threadId, postId, file, callback);
    }
  });

};

exports.generateAudioThumb = function(boardData, threadId, postId, file,
    callback) {

  var extensionToUse = settings.thumbExtension || 'png';

  var thumbDestination = file.pathInDisk + '_.' + extensionToUse;

  var mp3Command = mp3ThumbCommand.replace('{$path}', file.pathInDisk).replace(
      /\{\$destination\}/g, thumbDestination).replace('{$dimension}',
      thumbSize + 'x' + thumbSize);

  exec(mp3Command, function createdThumb(error) {

    if (error) {
      file.thumbPath = genericAudioThumb;
    } else {
      file.thumbOnDisk = thumbDestination;
      file.thumbMime = miscOps.getMime(thumbDestination);
    }

    exports.transferFilesToGS(boardData, threadId, postId, file, callback);
  });

};

exports.generateGifThumb = function(boardData, threadId, postId, file, cb) {

  var thumbDestination = file.pathInDisk + '_t';

  if (settings.thumbExtension) {
    thumbDestination += '.' + settings.thumbExtension;
  }

  file.thumbOnDisk = thumbDestination;
  file.thumbMime = file.mime;

  var command = 'convert \'' + file.pathInDisk + '[0]\' -resize ' + thumbSize;
  command += 'x' + thumbSize + ' ' + thumbDestination;

  exec(command, function resized(error) {
    if (error) {
      cb(error);
    } else {
      exports.transferFilesToGS(boardData, threadId, postId, file, cb);

    }
  });
};

exports.generateImageThumb = function(boardData, threadId, postId, file,
    callback) {

  var thumbDestination = file.pathInDisk + '_t';

  if (settings.thumbExtension) {
    thumbDestination += '.' + settings.thumbExtension;
  }

  file.thumbOnDisk = thumbDestination;
  file.thumbMime = file.mime;

  var command = 'convert ' + file.pathInDisk + ' -coalesce -resize ';
  command += thumbSize + 'x' + thumbSize + ' ' + thumbDestination;

  exec(command, function(error) {
    if (error) {
      callback(error);
    } else {
      exports.transferFilesToGS(boardData, threadId, postId, file, callback);
    }
  });

};

exports.processSpoilerThumb = function(boardData, threadId, postId, file,
    callback) {

  var spoilerToUse;

  if (boardData.usesCustomSpoiler) {
    spoilerToUse = '/' + boardData.boardUri + '/custom.spoiler';
  } else {
    spoilerToUse = spoilerPath;
  }

  file.thumbPath = spoilerToUse;

  exports.transferFilesToGS(boardData, threadId, postId, file, callback);
};

exports.processFile = function(boardData, threadId, postId, file, parameters,
    callback) {

  var tooSmall = file.height <= thumbSize && file.width <= thumbSize;

  var gifCondition = settings.thumbExtension || tooSmall;

  if (parameters.spoiler || file.spoiler) {

    exports.processSpoilerThumb(boardData, threadId, postId, file, callback);
  } else if (file.mime === 'image/gif' && gifCondition) {

    exports.generateGifThumb(boardData, threadId, postId, file, callback);

  } else if (file.mime.indexOf('image/') > -1 && !tooSmall) {

    exports.generateImageThumb(boardData, threadId, postId, file, callback);

  } else if (videoMimes.indexOf(file.mime) > -1 && settings.mediaThumb) {

    exports.generateVideoThumb(boardData, threadId, postId, file, tooSmall,
        callback);

  } else if (thumbAudioMimes.indexOf(file.mime) > -1 && settings.mediaThumb) {

    exports.generateAudioThumb(boardData, threadId, postId, file, callback);
  } else {

    if (thumbAudioMimes.indexOf(file.mime) > -1) {
      file.thumbPath = genericAudioThumb;
    } else if (file.mime.indexOf('image/') < 0) {
      file.thumbPath = genericThumb;
    }

    exports.transferFilesToGS(boardData, threadId, postId, file, callback);
  }
};

exports.saveUploads = function(boardData, threadId, postId, parameters,
    callback, index) {

  index = index || 0;

  if (index < parameters.files.length) {

    var file = parameters.files[index];

    exports.processFile(boardData, threadId, postId, file, parameters,
        function processedFile(error) {
          if (error) {
            callback(error);
          } else {
            exports.saveUploads(boardData, threadId, postId, parameters,
                callback, index + 1);
          }
        });

  } else {
    callback();
  }
};
// end of upload saving process
