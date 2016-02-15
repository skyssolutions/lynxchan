'use strict';

var fs = require('fs');
var crypto = require('crypto');
var mongo = require('mongodb');
var graphOps = require('./graphsOps');
var kernel = require('./kernel');
var db = require('./db');
var aggregatedLogs = db.aggregatedLogs();
var conn = db.conn();
var logs = db.logs();
var stats = db.stats();
var cachedFiles = db.files();
var ObjectID = mongo.ObjectID;
var exec = require('child_process').exec;
var cachedPosts = db.posts();
var cachedThreads = db.threads();
var cachedBoards = db.boards();
var cachedTorIps = db.torIps();
var cachedBans = db.bans();
var cachedUsers = db.users();
var settings = require('./settingsHandler').getGeneralSettings();
var thumbAudioMimes = [ 'audio/mpeg', 'audio/ogg' ];
var videoThumbCommand = 'ffmpeg -i {$path} -y -vframes 1 -vf scale=';
var mp3ThumbCommand = 'ffmpeg -i {$path} -y -an -vcodec copy {$destination}';
mp3ThumbCommand += ' && mogrify -resize {$dimension} {$destination}';
var videoMimes = [ 'video/webm', 'video/mp4', 'video/ogg' ];
var thumbSize = settings.thumbSize;
var mediaThumb = settings.mediaThumb;
var thumbExtension = settings.thumbExtension;
var tempDir = settings.tempDirectory;
var genericThumb = kernel.genericThumb();
var genericAudioThumb = kernel.genericAudioThumb();
var spoilerPath = kernel.spoilerImage();
var cachedReferences = db.uploadReferences();

// Added on 0.4.3
// Section 1: Mime pre-aggregation on upload data on postings {
function setPostingPreAggregatedFileMime(posting, collection, callback) {

  var files = [];

  for (var i = 0; i < posting.files.length; i++) {
    files.push(posting.files[i].path);
  }

  cachedFiles.find({
    filename : {
      $in : files
    }
  }, {
    filename : 1,
    contentType : 1
  }).toArray(function(error, foundFiles) {
    if (error) {
      callback(error);
    } else {

      var fileRelation = {};

      for (i = 0; i < foundFiles.length; i++) {
        var file = foundFiles[i];

        fileRelation[file.filename] = file.contentType;
      }

      for (i = 0; i < posting.files.length; i++) {
        posting.files[i].mime = fileRelation[posting.files[i].path];
      }

      collection.updateOne({
        _id : new ObjectID(posting._id)
      }, {
        $set : {
          files : posting.files
        }
      }, callback);

    }
  });

}

function setPostsPreAggreGatedFileMime(callback, cursor) {
  if (!cursor) {
    cursor = cachedPosts.find({
      'files.0' : {
        $exists : true
      }
    }, {
      files : 1
    });

  }

  cursor.next(function(error, post) {
    if (error) {
      callback(error);
    } else if (!post) {
      callback();
    } else {

      // style exception, too simple
      setPostingPreAggregatedFileMime(post, cachedPosts, function updatedMimes(
          error) {
        if (error) {
          callback(error);
        } else {
          setPostsPreAggreGatedFileMime(callback, cursor);
        }
      });
      // style exception, too simple

    }
  });
}

exports.setThreadsPreAggregatedFileMime = function(callback, cursor) {

  if (!cursor) {
    cursor = cachedThreads.find({
      'files.0' : {
        $exists : true
      }
    }, {
      files : 1
    });

  }

  cursor.next(function(error, thread) {
    if (error) {
      callback(error);
    } else if (!thread) {
      setPostsPreAggreGatedFileMime(callback);
    } else {

      // style exception, too simple
      setPostingPreAggregatedFileMime(thread, cachedThreads,
          function updatedMimes(error) {
            if (error) {
              callback(error);
            } else {
              exports.setThreadsPreAggregatedFileMime(callback, cursor);
            }
          });
      // style exception, too simple

    }
  });

};
// } Section 1: Mime pre-aggregation on upload data on postings

// Added on 0.5.1
// Section 2: Board salt creation {
exports.setBoardIpSalt = function(callback) {

  cachedBoards.find({}, {}).toArray(
      function gotBoards(error, boards) {
        if (error || !boards.length) {
          callback(error);
        } else {
          var operations = [];

          for (var i = 0; i < boards.length; i++) {
            var board = boards[i];

            operations.push({
              updateOne : {
                filter : {
                  boardUri : board.boardUri
                },
                update : {
                  $set : {
                    ipSalt : crypto.createHash('sha256').update(
                        JSON.stringify(board) + Math.random() + new Date())
                        .digest('hex')
                  }
                }
              }
            });
          }

          cachedBoards.bulkWrite(operations, callback);

        }
      });

};
// } Section 2: Board salt creation

// Added on 1.0.6
// Section 3: Ip conversion from strings to array of ints {
function convertIp(ip) {

  if (!ip) {
    return null;
  }

  var newIp = [];

  var converted = ip.trim().split('.');

  for (var i = 0; i < converted.length; i++) {
    var part = +converted[i];

    if (!isNaN(part) && part <= 255 && part >= 0) {
      newIp.push(part);
    }
  }

  return newIp;

}

function migrateTorIps(callback) {

  cachedTorIps.find().toArray(function gotTorIps(error, ips) {
    if (error) {
      callback(error);
    } else {

      var operations = [];

      for (var i = 0; i < ips.length; i++) {
        var ip = ips[i];

        operations.push({
          updateOne : {
            filter : {
              _id : new ObjectID(ip._id)
            },
            update : {
              $set : {
                ip : convertIp(ip.ip)
              }
            }
          }
        });

      }

      if (operations.length) {
        cachedTorIps.bulkWrite(operations, callback);

      } else {
        callback();
      }

    }
  });

}

function fixTorIpsIndex(callback) {

  cachedTorIps.dropIndex('ip_1', function indexesDropped(error) {
    if (error) {
      callback(error);
    } else {

      // style exception, too simple
      cachedTorIps.ensureIndex({
        ip : 1
      }, function setIndex(error, index) {
        if (error) {
          callback(error);

        } else {
          migrateTorIps(callback);
        }
      });
      // style exception, too simple

    }

  });

}

function migrateBanIps(callback) {

  cachedBans.find({}, {
    ip : 1,
    range : 1
  }).toArray(function gotBans(error, bans) {
    if (error) {
      callback(error);
    } else {

      var operations = [];

      for (var i = 0; i < bans.length; i++) {
        var ban = bans[i];

        var setBlock;

        if (ban.ip) {
          setBlock = {
            ip : convertIp(ban.ip)
          };
        } else {
          setBlock = {
            range : convertIp(ban.range)
          };
        }

        operations.push({
          updateOne : {
            filter : {
              _id : new ObjectID(ban._id)
            },
            update : {
              $set : setBlock
            }
          }
        });

      }

      if (operations.length) {
        // style exception, too simple
        cachedBans.bulkWrite(operations, function migratedIps(error) {
          if (error) {
            callback(error);
          } else {
            fixTorIpsIndex(callback);
          }
        });
        // style exception, too simple

      } else {
        fixTorIpsIndex(callback);
      }

    }
  });

}

function migratePostIps(callback) {

  cachedPosts.find({
    ip : {
      $exists : true
    }
  }, {
    ip : 1
  }).toArray(function gotPosts(error, posts) {
    if (error) {
      callback(error);
    } else {
      var operations = [];

      for (var i = 0; i < posts.length; i++) {
        var post = posts[i];

        operations.push({
          updateOne : {
            filter : {
              _id : new ObjectID(post._id)
            },
            update : {
              $set : {
                ip : convertIp(post.ip)
              }
            }
          }
        });
      }

      if (operations.length) {
        // style exception, too simple
        cachedPosts.bulkWrite(operations, function wroteIps(error) {
          if (error) {
            callback(error);
          } else {
            migrateBanIps(callback);
          }
        });
        // style exception, too simple

      } else {
        migrateBanIps(callback);
      }
    }
  });
}

exports.migrateThreadIps = function(callback) {

  cachedThreads.find({
    ip : {
      $exists : true
    }
  }, {
    ip : 1
  }).toArray(function gotThreads(error, threads) {
    if (error) {
      callback(error);
    } else {

      var operations = [];

      for (var i = 0; i < threads.length; i++) {
        var thread = threads[i];

        operations.push({
          updateOne : {
            filter : {
              _id : new ObjectID(thread._id)
            },
            update : {
              $set : {
                ip : convertIp(thread.ip)
              }
            }
          }
        });
      }

      if (operations.length) {

        // style exception, too simple
        cachedThreads.bulkWrite(operations, function wroteIps(error) {
          if (error) {
            callback(error);
          } else {
            migratePostIps(callback);
          }
        });
        // style exception, too simple

      } else {
        migratePostIps(callback);
      }
    }
  });
};
// } Section 3: Ip conversion from strings to array of ints

// Added on 1.3.0
// Section 4: Remove status from banners metadata {
exports.removeBannerStatus = function(callback) {

  cachedFiles.updateMany({
    'metadata.type' : 'banner'
  }, {
    $unset : {
      'metadata.status' : true
    }
  }, callback);

};
// } Section 4: Remove status from banners metadata

// Section 5: Aggregate log information {
exports.iterateDays = function(date, callback, foundResults) {

  foundResults = foundResults || [];

  if (date >= new Date()) {
    aggregatedLogs.deleteMany({}, function clearedCollection(error) {

      if (error) {
        callback(error);
      } else {
        aggregatedLogs.insertMany(foundResults, callback);
      }

    });

    return;
  }

  var next = new Date(date);
  next.setDate(next.getDate() + 1);

  logs.aggregate([ {
    $match : {
      time : {
        $gte : date,
        $lt : next
      }
    }
  }, {
    $project : {
      time : 1
    }
  }, {
    $group : {
      _id : 0,
      ids : {
        $push : '$_id'
      }
    }
  } ], function gotLogs(error, results) {

    if (error) {
      callback();
    } else {

      if (results.length) {
        foundResults.push({
          logs : results[0].ids,
          date : date
        });
      }

      exports.iterateDays(next, callback, foundResults);

    }

  });

};

exports.aggregateLogs = function(callback) {

  logs.aggregate([ {
    $project : {
      time : 1,
      _id : 0
    }
  }, {
    $group : {
      _id : 0,
      time : {
        $min : '$time'
      }
    }
  } ], function gotOldestLog(error, results) {

    if (error) {
      callback(error);
    } else if (!results.length) {
      callback();
    } else {
      var earliest = results[0].time;

      earliest.setHours(0);
      earliest.setMinutes(0);
      earliest.setSeconds(0);
      earliest.setMilliseconds(0);

      exports.iterateDays(earliest, callback);
    }

  });
};
// } Section 5: Aggregate log information

// Added on 1.4.0
// Section 6: Create message hash for existing postings {
exports.getMessageHash = function(message) {

  if (!message || !message.length) {
    return null;
  }

  message = message.toLowerCase().replace(/[ \n\t]/g, '');

  return crypto.createHash('md5').update(message).digest('base64');

};

exports.updatePostsR9KHashes = function(callback, postsCursor) {

  postsCursor = postsCursor || cachedPosts.find({}, {
    message : 1
  });

  postsCursor.next(function gotPost(error, post) {

    if (error) {
      callback(error);
    } else if (post) {

      // style exception, too simple
      cachedPosts.updateOne({
        _id : post._id
      }, {
        $set : {
          hash : exports.getMessageHash(post.message)
        }
      }, function updatedPost(error) {

        if (error) {
          callback(error);
        } else {
          exports.updatePostsR9KHashes(callback, postsCursor);
        }

      });
      // style exception, too simple

    } else {
      callback();
    }

  });
};

exports.createR9KHashes = function(callback, threadsCursor) {

  threadsCursor = threadsCursor || cachedThreads.find({}, {
    message : 1
  });

  threadsCursor.next(function gotThread(error, thread) {

    if (error) {
      callback(error);
    } else if (thread) {

      // style exception, too simple
      cachedThreads.updateOne({
        _id : thread._id
      }, {
        $set : {
          hash : exports.getMessageHash(thread.message)
        }
      }, function(error) {

        if (error) {
          callback(error);
        } else {
          exports.createR9KHashes(callback, threadsCursor);
        }

      });
      // style exception, too simple

    } else {
      exports.updatePostsR9KHashes(callback);
    }

  });

};
// } Section 6: Create message hash for existing postings

// Added on 1.5.0
exports.aggregateVolunteeredBoards = function(callback) {

  cachedBoards.find({
    'volunteers.0' : {
      $exists : true
    }
  }, {
    _id : 0,
    volunteers : 1,
    boardUri : 1
  }).toArray(function gotBoards(error, boards) {

    if (error) {
      callback(error);
    } else if (!boards.length) {
      callback();
    } else {

      var operations = [];

      for (var i = 0; i < boards.length; i++) {
        operations.push({

          updateMany : {
            filter : {
              login : {
                $in : boards[i].volunteers
              }
            },
            update : {
              $addToSet : {
                volunteeredBoards : boards[i].boardUri
              }
            }
          }

        });

      }

      cachedUsers.bulkWrite(operations, callback);

    }

  });

};

// Section 7: Graph generation {
exports.iterateDates = function(date, step, limit, callback) {

  if (date > limit) {
    callback();
    return;
  }

  graphOps.generate(date, function generated(error) {

    if (error) {
      callback(error);
    } else {

      date.setUTCDate(date.getUTCDate() + step);

      exports.iterateDates(date, step, limit, callback);

    }

  });

};

exports.getGraphStartDate = function(date) {

  var startDate = new Date(date);

  startDate.setUTCMilliseconds(0);
  startDate.setUTCSeconds(0);
  startDate.setUTCMinutes(0);
  startDate.setUTCHours(0);

  return startDate;

};

exports.getGraphLimitDate = function() {

  var newLimit = new Date();

  newLimit.setUTCMilliseconds(0);
  newLimit.setUTCSeconds(0);
  newLimit.setUTCMinutes(0);
  newLimit.setUTCHours(0);
  newLimit.setUTCDate(newLimit.getUTCDate() - 1);

  return newLimit;

};

exports.generateGraphs = function(callback) {

  stats.find().sort({
    startingTime : 1
  }).limit(1).toArray(function gotFirstDate(error, results) {

    if (error) {
      callback(error);
    } else if (results.length) {
      var dateToStart = exports.getGraphStartDate(results[0].startingTime);

      var newLimit = exports.getGraphLimitDate();

      var coreCount = require('os').cpus().length;

      var stopped = false;
      var remaining = coreCount;

      var loopCallBack = function(error) {

        if (stopped) {
          return;
        }

        if (error) {
          stopped = true;
          callback(error);
        } else {

          remaining--;

          if (!remaining) {
            callback();
          }

        }

      };

      for (var i = 0; i < coreCount; i++) {

        var specificDate = new Date(dateToStart);
        specificDate.setUTCDate(specificDate.getUTCDate() + i);

        exports.iterateDates(specificDate, coreCount, newLimit, loopCallBack);

      }

    } else {
      callback();
    }

  });

};
// } Section 7: Graph generation

// Added on 1.6.0

// Section 8: File deduplication {
function updatePostingDedupedFile(file, identifier, postingData, cb) {

  file.path = '/.media/' + identifier;
  file.thumb = '/.media/t_' + identifier;

  cachedFiles.findOne({
    filename : file.thumb
  }, function foundThumb(error, result) {

    if (error) {
      cb(error);
      return;
    } else if (!result) {

      if (thumbAudioMimes.indexOf(file.mime) > -1) {
        file.thumb = genericAudioThumb;
      } else if (file.mime.indexOf('image/') < 0) {
        file.thumb = genericThumb;
      } else {
        file.thumb = file.path;
      }

    }

    (postingData.postId ? cachedPosts : cachedThreads).updateOne({
      _id : postingData._id
    }, {
      $set : {
        files : postingData.files
      }
    }, cb);

  });

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

function writeFileToMongo(gs, thumbPath, callback) {

  gs.writeFile(thumbPath, function wroteFile(error) {

    fs.unlink(thumbPath);

    // style exception, too simple
    gs.close(function closed(closeError, result) {
      callback(error || closeError);
    });
    // style exception, too simple

  });

}

function moveFromDisk(thumbPath, identifier, callback) {

  var gs = mongo.GridStore(conn, '/.media/t_' + identifier, 'w', {
    'content_type' : exports.getMime(thumbPath),
    metadata : {
      lastModified : new Date(),
      type : 'media',
      identifier : identifier
    }
  });

  gs.open(function openedGs(error, gs) {

    if (error) {
      callback(error);
    } else {
      writeFileToMongo(gs, thumbPath, callback);
    }
  });

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

  } else if (videoMimes.indexOf(file.mime) > -1 && file.width && mediaThumb) {

    generateVideoThumb(tempPath, identifier, file, tooSmall, callback);

  } else if (thumbAudioMimes.indexOf(file.mime) > -1 && mediaThumb) {

    generateAudioThumb(tempPath, identifier, callback);

  } else {

    callback();

  }

}

function streamToDisk(path, stream, gs, callback) {

  gs.open(function openedGs(error, gs) {

    if (error) {
      callback(error);
      return;
    }

    var gfsStream = gs.stream();

    gfsStream.on('data', function(data) {
      stream.write(data);
    });

    gfsStream.on('error', function(error) {

      stream.end(function closedFileStream() {
        fs.unlink(path);
      });

      gs.close();
      callback(error);
    });

    gfsStream.on('end', function() {
      gs.close();
      stream.end(callback);
    });

  });

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

      var gs = mongo.GridStore(conn, file.thumb, 'r');
      var stream = fs.createWriteStream(tempPath);

      streamToDisk(tempPath, stream, gs, function streamed(error) {
        if (error) {
          callback(error);
        } else {

          var fileParts = file.originalName.split('.');
          var extension = fileParts[fileParts.length - 1];

          // style exception, too simple
          rebuildThumb(extension, tempPath, identifier, file,
              function thumbRebuild(error) {

                fs.unlink(tempPath);

                callback(error);

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

function removeDuplicates(file, identifier, postingData, callback) {

  var filesToRemove = [ file.path ];

  if (file.thumb.indexOf('/' + postingData.boardUri + '/media/') > -1) {
    filesToRemove.push(file.thumb);
  }

  mongo.GridStore.unlink(conn, filesToRemove, function deleted(error) {
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

  var identifier = file.md5 + '-' + file.mime;

  cachedReferences.findOneAndUpdate({
    identifier : identifier
  }, {
    $inc : {
      references : 1
    },
    $set : {
      identifier : identifier
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
          throw error;
        } else {
          deduplicateFilesForPosting(postingData, callback, ++index);
        }

      });
      // style exception, too simple

    } else {

      // style exception, too simple
      removeDuplicates(file, identifier, postingData,
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
    files : 1,
    boardUri : 1,
    postId : 1
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
    files : 1,
    boardUri : 1
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
// } Section 8: File deduplication

exports.MIMETYPES = {
  a : 'application/octet-stream',
  ai : 'application/postscript',
  aif : 'audio/x-aiff',
  aifc : 'audio/x-aiff',
  aiff : 'audio/x-aiff',
  au : 'audio/basic',
  avi : 'video/x-msvideo',
  bat : 'text/plain',
  bin : 'application/octet-stream',
  bmp : 'image/x-ms-bmp',
  c : 'text/plain',
  cdf : 'application/x-cdf',
  csh : 'application/x-csh',
  css : 'text/css',
  dll : 'application/octet-stream',
  doc : 'application/msword',
  dot : 'application/msword',
  dvi : 'application/x-dvi',
  eml : 'message/rfc822',
  eps : 'application/postscript',
  etx : 'text/x-setext',
  exe : 'application/octet-stream',
  gif : 'image/gif',
  gtar : 'application/x-gtar',
  h : 'text/plain',
  hdf : 'application/x-hdf',
  htm : 'text/html',
  html : 'text/html',
  jpe : 'image/jpeg',
  jpeg : 'image/jpeg',
  jpg : 'image/jpeg',
  js : 'application/x-javascript',
  ksh : 'text/plain',
  latex : 'application/x-latex',
  m1v : 'video/mpeg',
  man : 'application/x-troff-man',
  me : 'application/x-troff-me',
  mht : 'message/rfc822',
  mhtml : 'message/rfc822',
  mif : 'application/x-mif',
  mov : 'video/quicktime',
  movie : 'video/x-sgi-movie',
  mp2 : 'audio/mpeg',
  mp3 : 'audio/mpeg',
  mp4 : 'video/mp4',
  mpa : 'video/mpeg',
  mpe : 'video/mpeg',
  mpeg : 'video/mpeg',
  mpg : 'video/mpeg',
  ms : 'application/x-troff-ms',
  nc : 'application/x-netcdf',
  nws : 'message/rfc822',
  o : 'application/octet-stream',
  obj : 'application/octet-stream',
  oda : 'application/oda',
  ogg : 'audio/ogg',
  ogv : 'video/ogg',
  pbm : 'image/x-portable-bitmap',
  pdf : 'application/pdf',
  pfx : 'application/x-pkcs12',
  pgm : 'image/x-portable-graymap',
  png : 'image/png',
  pnm : 'image/x-portable-anymap',
  pot : 'application/vnd.ms-powerpoint',
  ppa : 'application/vnd.ms-powerpoint',
  ppm : 'image/x-portable-pixmap',
  pps : 'application/vnd.ms-powerpoint',
  ppt : 'application/vnd.ms-powerpoint',
  pptx : 'application/vnd.ms-powerpoint',
  ps : 'application/postscript',
  pwz : 'application/vnd.ms-powerpoint',
  py : 'text/x-python',
  pyc : 'application/x-python-code',
  pyo : 'application/x-python-code',
  qt : 'video/quicktime',
  ra : 'audio/x-pn-realaudio',
  ram : 'application/x-pn-realaudio',
  ras : 'image/x-cmu-raster',
  rdf : 'application/xml',
  rgb : 'image/x-rgb',
  roff : 'application/x-troff',
  rtx : 'text/richtext',
  sgm : 'text/x-sgml',
  sgml : 'text/x-sgml',
  sh : 'application/x-sh',
  shar : 'application/x-shar',
  snd : 'audio/basic',
  so : 'application/octet-stream',
  src : 'application/x-wais-source',
  swf : 'application/x-shockwave-flash',
  t : 'application/x-troff',
  tar : 'application/x-tar',
  tcl : 'application/x-tcl',
  tex : 'application/x-tex',
  texi : 'application/x-texinfo',
  texinfo : 'application/x-texinfo',
  tif : 'image/tiff',
  tiff : 'image/tiff',
  tr : 'application/x-troff',
  tsv : 'text/tab-separated-values',
  txt : 'text/plain',
  ustar : 'application/x-ustar',
  vcf : 'text/x-vcard',
  wav : 'audio/x-wav',
  webm : 'video/webm',
  wiz : 'application/msword',
  wsdl : 'application/xml',
  xbm : 'image/x-xbitmap',
  xlb : 'application/vnd.ms-excel',
  xls : 'application/vnd.ms-excel',
  xlsx : 'application/vnd.ms-excel',
  xml : 'text/xml',
  xpdl : 'application/xml',
  xpm : 'image/x-xpixmap',
  xsl : 'application/xml',
  xwd : 'image/x-xwindowdump',
  zip : 'application/zip'
};

exports.getMime = function(pathName) {

  var pathParts = pathName.split('.');

  var mime;

  if (pathParts.length) {
    var extension = pathParts[pathParts.length - 1];
    mime = exports.MIMETYPES[extension.toLowerCase()] || 'text/plain';

  } else {
    mime = 'text/plain';
  }

  return mime;
};
