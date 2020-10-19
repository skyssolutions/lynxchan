'use strict';

// handles any action regarding user uploads on posting

var fs = require('fs');
var logger = require('../logger');
var db = require('../db');
var uploadReferences = db.uploadReferences();
var exec = require('child_process').exec;
var kernel = require('../kernel');
var native = kernel.native;
var genericThumb = kernel.genericThumb();
var genericAudioThumb = kernel.genericAudioThumb();
var spoilerPath = kernel.spoilerImage();
var globalLatestImages = db.latestImages();
var files = db.files();
var videoDimensionsCommand = 'ffprobe -v error -show_entries ';
videoDimensionsCommand += 'stream=width,height ';
var videoThumbCommand = 'ffmpeg -i {$path} -y -vframes 1 -vf scale=';
var ffmpegGifCommand = 'ffmpeg -i {$path} -y -vf scale=';
var mp3ThumbCommand = 'ffmpeg -i {$path} -y -an -vcodec copy {$destination}';
mp3ThumbCommand += ' && mogrify -resize {$dimension} {$destination}';
var thumbSize;
var latestImages;
var miscOps;
var gsHandler;
var formOps;
var thumbExtension;
var mediaThumb;
var ffmpegGif;
var verbose;
var onlySfwImages;
var apngThreshold = 25 * 1024;

exports.correctedMimesRelation = {
  'video/webm' : 'audio/webm',
  'video/ogg' : 'audio/ogg'
};

exports.loadSettings = function() {

  var settings = require('../settingsHandler').getGeneralSettings();

  ffmpegGif = settings.ffmpegGifs;
  onlySfwImages = settings.onlySfwLatestImages;
  thumbSize = settings.thumbSize;
  latestImages = settings.globalLatestImages;
  mediaThumb = settings.mediaThumb;
  thumbExtension = settings.thumbExtension;

  verbose = settings.verboseMisc;
};

exports.loadDependencies = function() {

  miscOps = require('./miscOps');
  formOps = require('./formOps');
  gsHandler = require('./gridFsHandler');

};

// Section 1: Utility functions {
exports.getImageBounds = function(file, callback) {

  var path = file.pathInDisk;

  if (native) {
    return native.getImageBounds(path, callback);
  }

  exec('identify ' + path, {
    maxBuffer : Infinity
  }, function(error, results) {
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

  if (native) {
    return native.getVideoBounds(path, callback);
  }

  exec(videoDimensionsCommand + path, {
    maxBuffer : Infinity
  }, function gotDimensions(error, output) {

    if (error) {
      callback(error);
    } else {

      var matches = output.match(/width\=(\d+)\nheight\=(\d+)/);

      if (!matches) {
        var correctedMime = exports.correctedMimesRelation[file.mime];

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
// } Section 1: Utility functions

// Section 2: Upload handling {
exports.updatePostingFiles = function(file) {

  return {
    originalName : miscOps.cleanHTML(file.title),
    path : file.path,
    mime : file.mime,
    thumb : file.thumbPath,
    size : file.size,
    sha256 : file.sha256,
    width : file.width,
    height : file.height,
    spoiler : file.spoiler
  };

};

exports.postTransferThumb = function(error, meta, file, callback) {

  fs.unlink(file.thumbOnDisk, function deletedTempThumb(deletionError) {
    if (deletionError) {
      console.log(deletionError);
    }
  });

  if (error) {
    callback(error);
  } else {

    // style exception, too simple
    gsHandler.writeFile(file.pathInDisk, file.path, file.mime, meta, function(
        error) {
      callback(error, true);
    });
    // style exception, too simple

  }

};

// Section 2.1: New file {
exports.transferThumbToGfs = function(identifier, file, callback) {

  var meta = {
    sha256 : identifier,
    type : 'media'
  };

  gsHandler.writeFile(file.thumbOnDisk, file.thumbPath, file.thumbMime, meta,
      function wroteTbToGfs(error) {

        exports.postTransferThumb(error, meta, file, callback);

      });

};

exports.generateVideoThumb = function(identifier, file, tooSmall, callback) {

  var command = videoThumbCommand.replace('{$path}', file.pathInDisk);

  var extensionToUse = thumbExtension || 'png';

  var thumbDestination = file.pathInDisk + '_.' + extensionToUse;

  if (tooSmall) {
    command += '-1:-1';
  } else if (file.width > file.height) {
    command += thumbSize + ':-1';
  } else {
    command += '-1:' + thumbSize;
  }

  command += ' ' + thumbDestination;

  file.thumbMime = logger.getMime(thumbDestination);
  file.thumbOnDisk = thumbDestination;
  file.thumbPath = '/.media/t_' + identifier;

  exec(command, {
    maxBuffer : Infinity
  }, function createdThumb(error) {
    if (error) {
      callback(error);
    } else {
      exports.transferThumbToGfs(identifier, file, callback);
    }
  });

};

exports.generateAudioThumb = function(identifier, file, callback) {

  var extensionToUse = thumbExtension || 'png';

  var thumbDestination = file.pathInDisk + '_.' + extensionToUse;

  var mp3Command = mp3ThumbCommand.replace('{$path}', file.pathInDisk).replace(
      /\{\$destination\}/g, thumbDestination).replace('{$dimension}',
      thumbSize + 'x' + thumbSize);

  exec(mp3Command, {
    maxBuffer : Infinity
  }, function createdThumb(error) {

    if (error) {
      file.thumbPath = genericAudioThumb;

      gsHandler.writeFile(file.pathInDisk, file.path, file.mime, {
        sha256 : identifier,
        type : 'media'
      }, function(error) {
        callback(error);
      });

    } else {
      file.thumbOnDisk = thumbDestination;
      file.thumbMime = logger.getMime(thumbDestination);
      file.thumbPath = '/.media/t_' + identifier;

      exports.transferThumbToGfs(identifier, file, callback);

    }

  });

};

exports.generateGifThumb = function(identifier, file, cb) {

  var thumbDestination = file.pathInDisk + '_t';

  if (thumbExtension) {
    thumbDestination += '.' + thumbExtension;
  }

  file.thumbOnDisk = thumbDestination;
  file.thumbMime = thumbExtension ? logger.getMime(thumbDestination)
      : file.mime;
  file.thumbPath = '/.media/t_' + identifier;

  var command = 'convert \'' + file.pathInDisk + '[0]\' -resize ' + thumbSize;
  command += 'x' + thumbSize + ' ' + thumbDestination;

  exec(command, {
    maxBuffer : Infinity
  }, function resized(error) {
    if (error) {
      cb(error);
    } else {
      exports.transferThumbToGfs(identifier, file, cb);

    }
  });
};

exports.getFfmpegGifCommand = function(file, thumbDestination) {

  var command = ffmpegGifCommand.replace('{$path}', file.pathInDisk);

  if (file.width > file.height) {
    command += thumbSize + ':-1';
  } else {
    command += '-1:' + thumbSize;
  }

  command += ' ' + thumbDestination;

  return command;

};

exports.generateImageThumb = function(identifier, file, callback) {

  var thumbDestination = file.pathInDisk + '_t';

  var command;

  var thumbCb = function(error) {
    if (error) {
      return callback(error);
    }

    file.thumbOnDisk = thumbDestination;
    file.thumbMime = thumbExtension ? logger.getMime(thumbDestination)
        : file.mime;
    file.thumbPath = '/.media/t_' + identifier;

    exports.transferThumbToGfs(identifier, file, callback);

  };

  if (file.mime !== 'image/gif' || !ffmpegGif) {

    if (thumbExtension) {
      thumbDestination += '.' + thumbExtension;
    } else if (logger.reverseMimes[file.mime]) {
      thumbDestination += '.' + logger.reverseMimes[file.mime];
    }

    if (native) {

      return native.imageThumb(file.pathInDisk, thumbDestination, thumbSize,
          thumbCb);

    }

    command = 'convert ' + file.pathInDisk + ' -coalesce -resize ';
    command += thumbSize + 'x' + thumbSize + ' ' + thumbDestination;
  } else {

    thumbDestination += '.gif';
    command = exports.getFfmpegGifCommand(file, thumbDestination);
  }

  exec(command, {
    maxBuffer : Infinity
  }, thumbCb);

};

exports.decideOnDefaultThumb = function(file, identifier, callback) {

  if (file.mime.indexOf('audio/') > -1) {
    file.thumbPath = genericAudioThumb;
  } else if (file.mime.indexOf('image/') < 0) {
    file.thumbPath = genericThumb;
  } else {
    file.thumbPath = file.path;
  }

  gsHandler.writeFile(file.pathInDisk, file.path, file.mime, {
    sha256 : identifier,
    type : 'media'
  }, function(error) {
    callback(error);
  });

};

exports.generateThumb = function(identifier, file, callback) {

  var tooSmall = file.height <= thumbSize && file.width <= thumbSize;

  var gifCondition = thumbExtension || tooSmall;

  var apngCondition = gifCondition && file.size > apngThreshold;
  apngCondition = apngCondition && file.mime === 'image/png';

  var imageCondition = file.mime.indexOf('image/') > -1;
  imageCondition = imageCondition && !tooSmall && file.mime !== 'image/svg+xml';

  if (file.mime === 'image/gif' && gifCondition) {
    exports.generateGifThumb(identifier, file, callback);
  } else if (imageCondition || apngCondition) {
    exports.generateImageThumb(identifier, file, callback);
  } else if (file.mime.indexOf('video/') > -1 && mediaThumb) {
    exports.generateVideoThumb(identifier, file, tooSmall, callback);
  } else if (file.mime.indexOf('audio/') > -1 && mediaThumb) {
    exports.generateAudioThumb(identifier, file, callback);
  } else {
    exports.decideOnDefaultThumb(file, identifier, callback);
  }

};
// } Section 2.1: New file

exports.checkForThumb = function(reference, identifier, file) {

  var possibleThumbName = '/.media/t_' + identifier;

  if (reference.hasThumb) {
    file.thumbPath = possibleThumbName;
  } else if (file.mime.indexOf('audio/') > -1) {
    file.thumbPath = genericAudioThumb;
  } else if (file.mime.indexOf('image/') < 0) {
    file.thumbPath = genericThumb;
  } else {
    file.thumbPath = file.path;
  }

  return exports.updatePostingFiles(file);

};

exports.undoReference = function(error, identifier, callback) {

  uploadReferences.deleteOne({
    sha256 : identifier
  }, function removed(undoingError) {
    callback(undoingError || error);
  });

};

exports.updateHasThumb = function(identifier, file, callback) {

  uploadReferences.updateOne({
    sha256 : identifier
  }, {
    $set : {
      hasThumb : true
    }
  }, function(error) {

    if (error) {
      exports.undoReference(error, identifier, callback);
    } else {
      callback(null, file);
    }

  });

};

exports.processFile = function(file, callback) {

  var identifier = file.sha256;

  var extension = logger.reverseMimes[file.mime];

  file.path = '/.media/' + identifier;

  uploadReferences.findOneAndUpdate({
    sha256 : identifier
  }, {
    $inc : {
      references : 1
    },
    $setOnInsert : {
      sha256 : identifier,
      size : file.size,
      extension : extension,
      width : file.width,
      height : file.height
    }
  }, {
    upsert : true,
    returnOriginal : false
  }, function updatedReference(error, result) {

    if (error) {
      return callback(error);
    }

    if (result.lastErrorObject.updatedExisting) {

      if (result.value.extension) {
        file.path += '.' + result.value.extension;
      }

      return callback(null, exports.checkForThumb(result.value, identifier,
          file));

    }

    if (extension) {
      file.path += '.' + extension;
    }

    // style exception, too simple
    exports.generateThumb(identifier, file, function savedFile(error,
        generatedThumb) {

      if (error) {
        exports.undoReference(error, identifier, callback);
      } else if (generatedThumb) {

        exports.updateHasThumb(identifier, exports.updatePostingFiles(file),
            callback);

      } else {
        callback(null, exports.updatePostingFiles(file));
      }

    });
    // style exception, too simple

  });

};

exports.saveUploads = function(parameters, newFiles, callback, index) {

  index = index || 0;

  if (index >= parameters.files.length) {
    return callback();
  }

  var file = parameters.files[index];

  exports.processFile(file, function processedFile(error, newFile) {

    if (error && verbose) {
      console.log(error);
    }

    if (newFile) {
      newFiles.push(newFile);
    }

    exports.saveUploads(parameters, newFiles, callback, ++index);

  });

};
// } Section 2: Upload handling

// Section 3: Latest images handling {
exports.cleanLatestImages = function(callback) {

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
  } ]).toArray(function gotLatestPostsToClean(error, results) {

    if (error) {
      callback(error);
    } else if (!results.length) {

      process.send({
        frontPage : true
      });

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

          process.send({
            frontPage : true
          });

          callback();
        }
      });
      // style exception, too simple

    }

  });

};

exports.isBoardSfw = function(boardData) {

  var specialSettings = boardData.specialSettings || [];
  return specialSettings.indexOf('sfw') > -1;

};

exports.updateLatestImages = function(boardData, threadId, postId, files,
    callback) {

  if (!files) {
    return callback();
  }

  var sfwForbid = !exports.isBoardSfw(boardData) && onlySfwImages;

  if (sfwForbid || !latestImages || miscOps.omitted(boardData)) {
    return callback();
  }

  var toInsert = [];

  for (var i = 0; i < files.length; i++) {

    var file = files[i];

    if (file.mime.indexOf('image/') !== 0) {
      continue;
    }

    toInsert.push({
      postId : postId,
      threadId : threadId,
      creation : new Date(),
      boardUri : boardData.boardUri,
      thumb : file.thumb
    });
  }

  if (!toInsert.length) {
    return callback();
  }

  globalLatestImages.insertMany(toInsert, function insertedLatestImage(error) {

    if (error) {
      callback(error);
    } else {

      // style exception, too simple
      globalLatestImages.countDocuments(function counted(error, count) {

        if (error) {
          callback(error);
        } else if (count <= latestImages) {

          process.send({
            frontPage : true
          });

          callback();
        } else {
          exports.cleanLatestImages(callback);
        }

      });
      // style exception, too simple

    }

  });

};
// } Section 3: Latest images handling

exports.handleSpoilers = function(boardData, spoiler, files) {

  for (var i = 0; i < files.length; i++) {
    var file = files[i];

    if (spoiler || file.spoiler) {

      var spoilerToUse;

      if (boardData.usesCustomSpoiler) {
        spoilerToUse = '/' + boardData.boardUri + '/custom.spoiler';
      } else {
        spoilerToUse = spoilerPath;
      }

      file.thumb = spoilerToUse;
    }

    delete file.spoiler;

  }

  return files;

};
