'use strict';

// This migration gets a whole source file for itself, since its so big.

var toPrint = 'WARNING: I made critical changes to file deduplication that I ';
toPrint += 'couldn\'t test.\nIf you are reading this, be a bro and let me know';
toPrint += ' how everything went so I can either fix or remove this warning.';

console.log(toPrint);

var exec = require('child_process').exec;
var fs = require('fs');
var logger = require('./logger');
var kernel = require('./kernel');
var spoilerPath = kernel.spoilerImage();
var db = require('./db');
var cachedReferences = db.uploadReferences();
var bucket = new (require('mongodb')).GridFSBucket(db.conn());
var cachedPosts = db.posts();
var cachedThreads = db.threads();
var cachedChunks = db.chunks();
var cachedFiles = db.files();
var settings = require('./settingsHandler').getGeneralSettings();
var thumbSize = settings.thumbSize;
var thumbExtension = settings.thumbExtension;
var mediaThumb = settings.mediaThumb;
var tempDir = settings.tempDirectory;
var thumbAudioMimes = [ 'audio/mpeg', 'audio/ogg' ];
var videoThumbCommand = 'ffmpeg -i {$path} -y -vframes 1 -vf scale=';
var mp3ThumbCommand = 'ffmpeg -i {$path} -y -an -vcodec copy {$destination}';
mp3ThumbCommand += ' && mogrify -resize {$dimension} {$destination}';

function updatePostingDedupedFile(file, identifier, postingData, cb) {

  var hasThumb = file.path !== file.thumb;
  var boardMediaPath = '/' + postingData.boardUri + '/media/';
  var boardThumb = file.thumb.indexOf(boardMediaPath) === 0;

  delete file.name;
  file.path = '/.media/' + identifier;

  if (!hasThumb) {
    file.thumb = file.path;
  } else if (boardThumb) {
    file.thumb = '/.media/t_' + identifier;
  }

  (postingData.postId ? cachedPosts : cachedThreads).updateOne({
    _id : postingData._id
  }, {
    $set : {
      files : postingData.files
    }
  }, cb);

}

function moveFile(postingData, file, identifier, callback) {

  cachedFiles.updateOne({
    filename : file.path
  }, {
    $set : {
      filename : '/.media/' + identifier,
      'metadata.identifier' : identifier
    },
    $unset : {
      'metadata.boardUri' : 1,
      'metadata.threadId' : 1,
      'metadata.postId' : 1
    }
  }, function movedFile(error) {

    if (error) {
      callback(error);
    } else {
      updatePostingDedupedFile(file, identifier, postingData, callback);
    }

  });

}

function moveFromDisk(thumbPath, identifier, callback) {

  var readStream = fs.createReadStream(thumbPath);

  var uploadStream = bucket.openUploadStream('/.media/t_' + identifier, {
    contentType : logger.getMime(thumbPath),
    metadata : {
      lastModified : new Date(),
      type : 'media',
      identifier : identifier
    }
  });

  readStream.on('error', callback);
  uploadStream.on('error', callback);

  uploadStream.once('finish', function uploaded() {
    fs.unlinkSync(thumbPath);
    callback();
  });

  readStream.pipe(uploadStream);

}

function generateVideoThumb(tempPath, identifier, file, tooSmall, callback) {

  var command = videoThumbCommand.replace('{$path}', tempPath);

  var extensionToUse = thumbExtension || 'png';

  var thumbPath = tempPath + '.' + extensionToUse;

  if (tooSmall) {
    command += '-1:-1';
  } else if (file.width > file.height) {
    command += thumbSize + ':-1';
  } else {
    command += '-1:' + thumbSize;
  }

  command += ' ' + thumbPath;

  exec(command, function createdThumb(error) {
    if (error) {
      callback(error);
    } else {
      moveFromDisk(thumbPath, identifier, callback);
    }
  });

}

function generateAudioThumb(tempPath, identifier, callback) {

  var extensionToUse = thumbExtension || 'png';

  var thumbDestination = tempPath + '.' + extensionToUse;

  var mp3Command = mp3ThumbCommand.replace('{$path}', tempPath).replace(
      /\{\$destination\}/g, thumbDestination).replace('{$dimension}',
      thumbSize + 'x' + thumbSize);

  exec(mp3Command, function createdThumb(error) {

    if (error) {
      callback();
    } else {

      moveFromDisk(thumbDestination, identifier, callback);
    }

  });

}

function generateGifThumb(extension, tempPath, identifier, cb) {

  var extensionToUse = thumbExtension || extension;

  var thumbDestination = tempPath + '.' + extensionToUse;

  var command = 'convert \'' + tempPath + '[0]\' -resize ' + thumbSize;
  command += 'x' + thumbSize + ' ' + thumbDestination;

  exec(command, function resized(error) {
    if (error) {
      cb(error);
    } else {
      moveFromDisk(thumbDestination, identifier, cb);

    }
  });
}

function generateImageThumb(extension, tempPath, identifier, callback) {

  var extensionToUse = thumbExtension || extension;

  var thumbDestination = tempPath + '.' + extensionToUse;

  if (thumbExtension) {
    thumbDestination += '.' + thumbExtension;
  }

  var command = 'convert ' + tempPath + ' -coalesce -resize ';
  command += thumbSize + 'x' + thumbSize + ' ' + thumbDestination;

  exec(command, function(error) {
    if (error) {
      callback(error);
    } else {
      moveFromDisk(thumbDestination, identifier, callback);
    }
  });

}

function rebuildThumb(extension, tempPath, identifier, file, callback) {

  var tooSmall = file.height <= thumbSize && file.width <= thumbSize;

  var gifCondition = thumbExtension || tooSmall;

  if (file.mime === 'image/gif' && gifCondition) {

    generateGifThumb(extension, tempPath, identifier, callback);

  } else if (file.mime.indexOf('image/') > -1 && !tooSmall) {

    generateImageThumb(extension, tempPath, identifier, callback);

  } else if (file.mime.indexOf('video/') > -1 && file.width && mediaThumb) {

    generateVideoThumb(tempPath, identifier, file, tooSmall, callback);

  } else if (thumbAudioMimes.indexOf(file.mime) > -1 && mediaThumb) {

    generateAudioThumb(tempPath, identifier, callback);

  } else {

    callback();

  }

}

function streamToDisk(tempPath, sourcePath, callback) {

  var readStream = bucket.openDownloadStreamByName(sourcePath);
  var uploadStream = fs.createWriteStream(tempPath);

  readStream.on('error', callback);
  uploadStream.on('error', callback);

  uploadStream.once('finish', callback);

  readStream.pipe(uploadStream);

}

function moveThumbNail(postingData, file, identifier, callback) {

  // Rules
  // 1: if the file uses itself as the thumb, it won't get a thumb.
  // 2: if the file thumb lives on /board/media/ we just move it
  // 3: if the file is spoilered we try to generate a thumb
  // 4: if the file uses a generic thumb, it won't get a thumb

  var mediaPath = '/' + postingData.boardUri + '/media/';

  if (file.thumb === file.path) {
    moveFile(postingData, file, identifier, callback);
    return;
  } else if (file.thumb.indexOf(mediaPath) === -1) {

    var customSpoilerPath = '/' + postingData.boardUri + '/custom.spoiler';

    if (file.thumb === customSpoilerPath || file.thumb === spoilerPath) {

      var tempPath = tempDir + '/' + identifier;

      streamToDisk(tempPath, file.path, function streamed(error) {
        if (error) {
          callback(error);
        } else {

          var fileParts = file.originalName.split('.');
          var extension = fileParts[fileParts.length - 1];

          // style exception, too simple
          rebuildThumb(extension, tempPath, identifier, file,
              function thumbRebuild(error) {

                fs.unlinkSync(tempPath);

                if (error) {
                  callback(error);
                } else {
                  moveFile(postingData, file, identifier, callback);
                }

              });
          // style exception, too simple

        }
      });

    } else {
      moveFile(postingData, file, identifier, callback);
      return;
    }

  } else {

    cachedFiles.updateOne({
      filename : file.thumb
    }, {
      $set : {
        filename : '/.media/t_' + identifier,
        'metadata.identifier' : identifier
      },
      $unset : {
        'metadata.boardUri' : 1,
        'metadata.threadId' : 1,
        'metadata.postId' : 1
      }
    }, function movedThumb(error) {

      if (error) {
        callback(error);
      } else {
        moveFile(postingData, file, identifier, callback);
      }

    });

  }

}

function removeChunks(results, callback) {

  cachedChunks.removeMany({
    'files_id' : {
      $in : results[0].ids
    }
  }, function removedChunks(error) {

    if (error) {
      callback(error);
    } else {

      cachedFiles.removeMany({
        _id : {
          $in : results[0].ids
        }
      }, callback);

    }

  });

}

function removeFile(name, callback) {

  cachedFiles.aggregate([ {
    $match : {
      filename : {
        $in : name
      }
    }
  }, {
    $group : {
      _id : 0,
      ids : {
        $push : '$_id'
      }
    }
  } ]).toArray(function gotFiles(error, results) {

    if (error || !results.length) {
      callback(error);
    } else {
      removeChunks(results, callback);
    }

  });

}

function handleDuplicateFile(file, identifier, postingData, callback) {

  var filesToRemove = [ file.path ];

  if (file.thumb.indexOf('/' + postingData.boardUri + '/media/') > -1) {
    filesToRemove.push(file.thumb);
  }

  removeFile(filesToRemove, function removedFiles(error) {

    if (error) {
      callback(error);
    } else {
      updatePostingDedupedFile(file, identifier, postingData, callback);
    }

  });

}

function checkPostingMigration(postingData) {

  for (var i = 0; i < postingData.files.length; i++) {

    if (postingData.files[i].path.indexOf('/.media/') !== 0) {
      return true;
    }
  }
}

function deduplicateFilesForPosting(postingData, callback, index) {

  index = index || 0;

  if (!index) {

    if (!checkPostingMigration(postingData)) {
      callback();
      return;
    }

  } else if (index >= postingData.files.length) {
    callback();
    return;

  }

  var file = postingData.files[index];

  // Testing if specific file has been already migrated
  if (file.path.indexOf('/.media/') === 0) {
    deduplicateFilesForPosting(postingData, callback, ++index);

    return;
  }

  var identifier = file.md5 + '-' + file.mime.replace('/', '');

  cachedReferences.findOneAndUpdate({
    identifier : identifier
  }, {
    $inc : {
      references : 1
    },
    $setOnInsert : {
      identifier : identifier,
      size : file.size,
      width : file.width,
      height : file.height
    }
  }, {
    upsert : true,
    returnOriginal : false
  }, function updatedReference(error, result) {

    if (error) {
      callback(error);
    } else if (result.value.references === 1) {

      // style exception, too simple
      moveThumbNail(postingData, file, identifier, function movedThumbnail(
          error) {

        if (error) {
          callback(error);
        } else {
          deduplicateFilesForPosting(postingData, callback, ++index);
        }

      });
      // style exception, too simple

    } else {

      // style exception, too simple
      handleDuplicateFile(file, identifier, postingData,
          function removedDuplicate(error) {

            if (error) {
              callback(error);
            } else {
              deduplicateFilesForPosting(postingData, callback, ++index);
            }

          });
      // style exception, too simple

    }

  });

}

function deduplicatePostsFiles(callback, lastPostId) {

  var matchBlock = {
    'files.0' : {
      $exists : true
    }
  };

  if (lastPostId) {
    matchBlock._id = {
      $gt : lastPostId
    };
  }

  cachedPosts.find(matchBlock, {
    projection : {
      files : 1,
      boardUri : 1,
      postId : 1
    }
  }).sort({
    _id : 1
  }).limit(1).toArray(function gotThread(error, results) {

    if (!results || !results.length) {

      callback(error);
    } else {

      var post = results[0];

      // style exception, too simple
      deduplicateFilesForPosting(post, function deduplicatedPosting(error) {

        if (error) {
          callback(error);
        } else {
          deduplicatePostsFiles(callback, post._id);
        }

      });
      // style exception, too simple

    }

  });

}

exports.deduplicateFiles = function(callback, lastThreadId) {

  var matchBlock = {
    'files.0' : {
      $exists : true
    }
  };

  if (lastThreadId) {
    matchBlock._id = {
      $gt : lastThreadId
    };
  }

  cachedThreads.find(matchBlock, {
    projection : {
      files : 1,
      boardUri : 1
    }
  }).sort({
    _id : 1
  }).limit(1).toArray(function gotThread(error, results) {

    if (error) {
      callback(error);
    } else if (!results || !results.length) {

      deduplicatePostsFiles(callback);
    } else {

      var thread = results[0];

      // style exception, too simple
      deduplicateFilesForPosting(thread, function deduplicatedPosting(error) {

        if (error) {
          callback(error);
        } else {
          exports.deduplicateFiles(callback, thread._id);
        }

      });
      // style exception, too simple

    }

  });

};