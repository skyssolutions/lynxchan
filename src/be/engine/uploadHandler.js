'use strict';

// handles any action regarding user uploads on posting

var fs = require('fs');
var logger = require('../logger');
var db = require('../db');
var threads = db.threads();
var uploadReferences = db.uploadReferences();
var boards = db.boards();
var exec = require('child_process').exec;
var kernel = require('../kernel');
var genericThumb = kernel.genericThumb();
var genericAudioThumb = kernel.genericAudioThumb();
var spoilerPath = kernel.spoilerImage();
var globalLatestImages = db.latestImages();
var posts = db.posts();
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

exports.thumbAudioMimes = [ 'audio/mpeg', 'audio/ogg', 'audio/webm',
    'audio/flac' ];

exports.videoMimes = [ 'video/webm', 'video/mp4', 'video/ogg' ];

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
  gsHandler = require('./gridFsHandler');

};

// Section 1: Utility functions {
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
  } ]).toArray(
      function gotLatestPostsToClean(error, results) {

        if (error) {
          callback(error);
        } else if (!results.length) {

          process.send({
            frontPage : true
          });

          exports.updatePostingFiles(boardData, threadId, postId, file,
              callback, false, true);

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
      globalLatestImages.countDocuments(function counted(error, count) {

        if (error) {
          callback(error);
        } else if (count <= latestImages) {

          process.send({
            frontPage : true
          });

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

exports.isBoardSfw = function(boardData) {

  var specialSettings = boardData.specialSettings || [];
  return specialSettings.indexOf('sfw') > -1;

};

exports.updatePostingFiles = function(boardData, threadId, postId, file,
    callback, updatedFileCount, updatedLatestImages) {

  var image = file.mime.indexOf('image/') > -1 && !miscOps.omitted(boardData);

  // add image to latest images before proceeding
  if (latestImages && !updatedLatestImages && image) {

    if (exports.isBoardSfw(boardData) || !onlySfwImages) {
      exports.updateLatestImages(boardData, threadId, postId, file, callback);
      return;
    }

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

  collectionToQuery.updateOne(queryBlock, {
    $unset : {
      innerCache : 1,
      outerCache : 1,
      previewCache : 1,
      alternativeCaches : 1,
      clearCache : 1,
      hashedCache : 1
    },
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

// Section 2.1: New file {
exports.transferThumbToGfs = function(identifier, file, callback) {

  var meta = {
    identifier : identifier,
    type : 'media'
  };

  gsHandler.writeFile(file.thumbOnDisk, file.thumbPath, file.thumbMime, meta,
      function wroteTbToGfs(error) {

        fs.unlink(file.thumbOnDisk, function deletedTempThumb(deletionError) {
          if (deletionError) {
            console.log(deletionError);
          }
        });

        if (error) {
          callback(error);
        } else {
          gsHandler.writeFile(file.pathInDisk, file.path, file.mime, meta,
              callback);
        }

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

  exec(command, function createdThumb(error) {
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

  exec(mp3Command, function createdThumb(error) {

    if (error) {
      file.thumbPath = genericAudioThumb;

      gsHandler.writeFile(file.pathInDisk, file.path, file.mime, {
        identifier : identifier,
        type : 'media'
      }, callback);

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
  file.thumbMime = file.mime;
  file.thumbPath = '/.media/t_' + identifier;

  var command = 'convert \'' + file.pathInDisk + '[0]\' -resize ' + thumbSize;
  command += 'x' + thumbSize + ' ' + thumbDestination;

  exec(command, function resized(error) {
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

  if (file.mime !== 'image/gif' || !ffmpegGif) {

    if (thumbExtension) {
      thumbDestination += '.' + thumbExtension;
    }

    command = 'convert ' + file.pathInDisk + ' -coalesce -resize ';
    command += thumbSize + 'x' + thumbSize + ' ' + thumbDestination;
  } else {

    thumbDestination += '.gif';
    command = exports.getFfmpegGifCommand(file, thumbDestination);
  }

  file.thumbOnDisk = thumbDestination;
  file.thumbMime = file.mime;
  file.thumbPath = '/.media/t_' + identifier;

  exec(command, function(error) {
    if (error) {
      callback(error);
    } else {
      exports.transferThumbToGfs(identifier, file, callback);
    }
  });

};

exports.decideOnDefaultThumb = function(file, identifier, callback) {

  if (exports.thumbAudioMimes.indexOf(file.mime) > -1) {
    file.thumbPath = genericAudioThumb;
  } else if (file.mime.indexOf('image/') < 0) {
    file.thumbPath = genericThumb;
  } else {
    file.thumbPath = file.path;
  }

  gsHandler.writeFile(file.pathInDisk, file.path, file.mime, {
    identifier : identifier,
    type : 'media'
  }, callback);

};

exports.generateThumb = function(identifier, file, callback) {

  var tooSmall = file.height <= thumbSize && file.width <= thumbSize;

  var gifCondition = thumbExtension || tooSmall;

  var apngCondition = gifCondition && file.size > apngThreshold;
  apngCondition = apngCondition && file.mime === 'image/png';

  var imageCondition = apngCondition || file.mime.indexOf('image/') > -1;
  imageCondition = imageCondition && !tooSmall && file.mime !== 'image/svg+xml';

  if (file.mime === 'image/gif' && gifCondition) {
    exports.generateGifThumb(identifier, file, callback);
  } else if (imageCondition) {
    exports.generateImageThumb(identifier, file, callback);
  } else if (exports.videoMimes.indexOf(file.mime) > -1 && mediaThumb) {
    exports.generateVideoThumb(identifier, file, tooSmall, callback);
  } else if (exports.thumbAudioMimes.indexOf(file.mime) > -1 && mediaThumb) {
    exports.generateAudioThumb(identifier, file, callback);
  } else {
    exports.decideOnDefaultThumb(file, identifier, callback);
  }

};

exports.updatePostingWithNewUpload = function(parameters, identifier,
    boardData, threadId, postId, file, callback) {

  if (parameters.spoiler || file.spoiler) {

    var spoilerToUse;

    if (boardData.usesCustomSpoiler) {
      spoilerToUse = '/' + boardData.boardUri + '/custom.spoiler';
    } else {
      spoilerToUse = spoilerPath;
    }

    file.thumbPath = spoilerToUse;

  }

  exports.updatePostingFiles(boardData, threadId, postId, file,
      function updatedPosting(error) {

        if (error) {
          exports.undoReference(error, identifier, callback);
        } else {
          callback();
        }

      });

};
// } Section 2.1: New file

exports.checkForThumb = function(reference, identifier, boardData, threadId,
    postId, file, parameters, callback) {

  if (parameters.spoiler || file.spoiler) {

    var spoilerToUse;

    if (boardData.usesCustomSpoiler) {
      spoilerToUse = '/' + boardData.boardUri + '/custom.spoiler';
    } else {
      spoilerToUse = spoilerPath;
    }

    file.thumbPath = spoilerToUse;

    exports.updatePostingFiles(boardData, threadId, postId, file, callback);

    return;
  }

  var possibleThumbName = '/.media/t_' + identifier;

  if (reference.hasThumb) {
    file.thumbPath = possibleThumbName;
    exports.updatePostingFiles(boardData, threadId, postId, file, callback);
    return;
  }

  files.findOne({
    filename : possibleThumbName
  }, function gotThumb(error, result) {

    if (error) {
      callback(error);
    } else if (!result) {

      if (exports.thumbAudioMimes.indexOf(file.mime) > -1) {
        file.thumbPath = genericAudioThumb;
      } else if (file.mime.indexOf('image/') < 0) {
        file.thumbPath = genericThumb;
      } else {
        file.thumbPath = file.path;
      }

    } else {
      file.thumbPath = possibleThumbName;
    }

    exports.updatePostingFiles(boardData, threadId, postId, file, callback);

  });

};

exports.undoReference = function(error, identifier, callback, removal) {

  if (removal) {

    uploadReferences.deleteOne({
      identifier : identifier
    }, function removed(undoingError) {
      callback(undoingError || error);
    });

    return;
  }

  uploadReferences.updateOne({
    identifier : identifier
  }, {
    $inc : {
      references : -1
    }
  }, function undone(undoingError) {
    callback(undoingError || error);
  });

};

exports.willRequireThumb = function(file) {

  var tooSmall = file.height <= thumbSize && file.width <= thumbSize;

  var gifCondition = thumbExtension || tooSmall;

  var svg = file.mime === 'image/svg+xml';

  var apngCondition = gifCondition && file.size > apngThreshold;
  apngCondition = apngCondition && file.mime === 'image/png';

  var imageCondition = apngCondition || file.mime.indexOf('image/') > -1;
  imageCondition = imageCondition && !tooSmall && !svg;

  if (file.mime === 'image/gif' && gifCondition) {
    return true;
  } else if (imageCondition) {
    return true;
  } else if (exports.videoMimes.indexOf(file.mime) > -1 && mediaThumb) {
    return true;
  }

};

exports.processFile = function(boardData, threadId, postId, file, parameters,
    callback) {

  var identifier = file.md5 + '-' + file.mime.replace('/', '');

  var extension = logger.reverseMimes[file.mime];

  file.path = '/.media/' + identifier;

  uploadReferences.findOneAndUpdate({
    identifier : identifier
  }, {
    $inc : {
      references : 1
    },
    $setOnInsert : {
      identifier : identifier,
      size : file.size,
      extension : extension,
      width : file.width,
      height : file.height,
      hasThumb : exports.willRequireThumb(file)
    }
  }, {
    upsert : true,
    returnOriginal : false
  }, function updatedReference(error, result) {

    if (error) {
      callback(error);
    } else if (!result.lastErrorObject.updatedExisting) {

      if (extension) {
        file.path += '.' + extension;
      }

      // style exception, too simple
      exports.generateThumb(identifier, file, function savedFile(error) {

        if (error) {
          exports.undoReference(error, identifier, callback, true);
        } else {
          exports.updatePostingWithNewUpload(parameters, identifier, boardData,
              threadId, postId, file, callback);
        }

      });
      // style exception, too simple

    } else {

      if (result.value.extension) {
        file.path += '.' + result.value.extension;
      }

      exports.checkForThumb(result.value, identifier, boardData, threadId,
          postId, file, parameters, function updatedPosting(error) {

            if (error) {
              exports.undoReference(error, identifier, callback);
            } else {
              callback();
            }

          });
    }

  });

};

exports.saveUploads = function(boardData, threadId, postId, parameters,
    callback, index) {

  index = index || 0;

  if (index < parameters.files.length) {

    var file = parameters.files[index];

    exports.processFile(boardData, threadId, postId, file, parameters,
        function processedFile(error) {

          if (error && verbose) {
            console.log(error);
          }

          exports.saveUploads(boardData, threadId, postId, parameters,
              callback, ++index);

        });

  } else {
    callback();
  }
};
// } Section 2: Upload handling
