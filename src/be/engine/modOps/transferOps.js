'use strict';

// handles operations related to the transfer of threads between boards

var mongo = require('mongodb');
var spoilerPath = require('../../kernel').spoilerImage();
var logger = require('../../logger');
var db = require('../../db');
var boards = db.boards();
var threads = db.threads();
var posts = db.posts();
var logOps;
var miscOps;
var lang;

exports.loadDependencies = function() {

  logOps = require('../logOps');
  miscOps = require('../miscOps');
  lang = require('../langOps').languagePack;

};

// Section 1: Posting files update {
exports.getAdjustedFiles = function(newBoard, originalThread, files) {

  if (!files || !files.length) {
    return files;
  }

  var newFiles = [];

  for (var i = 0; i < files.length; i++) {

    var file = files[i];

    var cp = JSON.parse(JSON.stringify(file));

    var spoilered = cp.thumb.indexOf('spoiler.') > -1;
    var customSpolier = cp.thumb.indexOf('.spoiler') > -1;

    spoilered = spoilered || customSpolier;

    if (spoilered && newBoard.usesCustomSpoiler) {
      // we got a spoilered file AND the new board uses custom spoiler?
      cp.thumb = '/' + newBoard.boardUri + '/custom.spoiler';
    } else if (customSpolier) {
      // it uses a custom spoiler but the new board doesn`t have one?
      cp.thumb = spoilerPath;
    }

    newFiles.push(cp);

  }

  return newFiles;

};
// } Section 1: Posting files update

// Section 2: Reverts {
exports.revertThreadCount = function(revertOps, originalError, callback) {

  boards.bulkWrite(revertOps, function revertedThreadCounts(error) {

    if (error) {
      console.log(error);
    }

    callback(originalError);

  });

};

exports.revertThread = function(thread, originalError, callback) {

  threads.updateOne({
    _id : thread._id
  }, {
    $set : {
      boardUri : thread.boardUri,
      threadId : thread.threadId,
      files : thread.files,
      flag : thread.flag,
      latestPosts : thread.latestPosts,
      flagName : thread.flagName
    }
  }, function revertedThread(error) {

    if (error) {
      console.log(error);
    }

    callback(originalError);

  });

};
// } Section 2: Reverts

exports.logTransfer = function(newBoard, userData, newThreadId, originalThread,
    callback) {

  var message = lang().logThreadTransfer.replace('{$login}', userData.login)
      .replace('{$thread}', originalThread.threadId).replace('{$board}',
          originalThread.boardUri).replace('{$boardDestination}',
          newBoard.boardUri);

  logOps.insertLog({
    user : userData.login,
    type : 'threadTransfer',
    time : new Date(),
    boardUri : originalThread.boardUri,
    global : true,
    description : message
  }, callback);

};

// Section 3: Files update {
exports.getNewMeta = function(file, newThreadId, newBoard, newPostId) {

  var newMeta = JSON.parse(JSON.stringify(file.metadata));
  newMeta.lastModified = new Date();
  newMeta.threadId = newThreadId;
  newMeta.boardUri = newBoard.boardUri;

  if (newPostId) {
    newMeta.postId = newPostId;
  }

  return newMeta;

};

exports.getThreadNewPath = function(newBoard, newThreadId, name) {

  var newPath = '/' + newBoard.boardUri + '/res/' + newThreadId + '.';

  if (name.indexOf('html') > 1) {
    newPath += 'html';
  } else {
    newPath += 'json';
  }

  return newPath;
};

exports.getFileUpdateOps = function(newPostIdRelation, originalThread,
    newBoard, newThreadId, foundFiles) {

  var updateOps = [];

  for (var i = 0; i < foundFiles.length; i++) {
    var file = foundFiles[i];

    var newPostId = newPostIdRelation[file.metadata.postId];

    var newMeta = exports.getNewMeta(file, newThreadId, newBoard, newPostId);

    var newPath = exports.getThreadNewPath(newBoard, newThreadId, file.filename
        .split('/')[3]);

    if (file.filename.indexOf('gz') === file.filename.length - 2) {
      newMeta.referenceFile = newPath;
      newPath += '.gz';
    }

    updateOps.push({
      updateOne : {
        filter : {
          _id : file._id
        },
        update : {
          $set : {
            metadata : newMeta,
            filename : newPath
          }
        }
      }
    });

  }

  return updateOps;

};

exports.runRebuilds = function(newBoard, newThreadId, originalThread, userData,
    callback) {

  process.send({
    multiboard : true,
    board : newBoard.boardUri
  });

  process.send({
    multiboard : true,
    board : originalThread.boardUri
  });

  process.send({
    board : newBoard.boardUri
  });

  process.send({
    board : originalThread.boardUri
  });

  process.send({
    board : originalThread.boardUri,
    thread : originalThread.threadId
  });

  exports
      .logTransfer(newBoard, userData, newThreadId, originalThread, callback);

};

// Section 4: Posts update {
exports.getPostsOps = function(newPostIdRelation, newBoard, foundPosts,
    updateOps, newThreadId, originalThread) {

  for (var i = 0; i < foundPosts.length; i++) {
    var post = foundPosts[i];

    var newPostId = newThreadId + 1 + i;

    newPostIdRelation[post.postId] = newPostId;

    updateOps.push({
      updateOne : {
        filter : {
          _id : post._id
        },
        update : {
          $set : {
            boardUri : newBoard.boardUri,
            threadId : newThreadId,
            postId : newPostId,
            files : exports.getAdjustedFiles(newBoard, originalThread,
                post.files)
          },
          $unset : {
            flag : 1,
            flagName : 1,
            innerCache : 1,
            outerCache : 1,
            alternativeCaches : 1,
            previewCache : 1,
            clearCache : 1,
            hashedCache : 1
          }
        }
      }
    });

  }

};

exports.updatePosts = function(newBoard, userData, foundPosts, newThreadId,
    originalThread, callback) {

  var updateOps = [];
  var newPostIdRelation = {};

  exports.getPostsOps(newPostIdRelation, newBoard, foundPosts, updateOps,
      newThreadId, originalThread);

  if (!updateOps.length) {

    exports.runRebuilds(newBoard, newThreadId, originalThread, userData,
        callback);

    return;
  }

  posts.bulkWrite(updateOps, function updatedPosts(error) {
    if (error) {
      callback(error);
    } else {

      exports.runRebuilds(newBoard, newThreadId, originalThread, userData,
          callback);

    }
  });

};

exports.findPosts = function(newBoard, userData, originalThread, newThreadId,
    cb) {

  posts.find({
    boardUri : originalThread.boardUri,
    threadId : originalThread.threadId
  }, {
    projection : {
      postId : 1,
      files : 1
    }
  }).sort({
    postId : 1
  }).toArray(
      function gotPosts(error, foundPosts) {
        if (error) {
          cb(error);
        } else {
          exports.updatePosts(newBoard, userData, foundPosts, newThreadId,
              originalThread, cb);
        }
      });

};
// }Section 4: Posts update

// Section 5: Thread count update {
exports.getThreadCountOps = function(updateOps, revertOps, newBoard,
    originalThread) {

  revertOps.push({
    updateOne : {
      filter : {
        boardUri : newBoard.boardUri
      },
      update : {
        $inc : {
          threadCount : -1
        }
      }
    }
  });

  revertOps.push({
    updateOne : {
      filter : {
        boardUri : originalThread.boardUri
      },
      update : {
        $inc : {
          threadCount : 1
        }
      }
    }
  });

  updateOps.push({
    updateOne : {
      filter : {
        boardUri : newBoard.boardUri
      },
      update : {
        $inc : {
          threadCount : 1
        }
      }
    }
  });

  updateOps.push({
    updateOne : {
      filter : {
        boardUri : originalThread.boardUri
      },
      update : {
        $inc : {
          threadCount : -1
        }
      }
    }
  });

};

exports.updateThreadCount = function(newBoard, userData, originalThread,
    newThreadId, callback) {

  var updateOps = [];

  var revertOps = [];

  exports.getThreadCountOps(updateOps, revertOps, newBoard, originalThread);

  boards.bulkWrite(updateOps, function updatedThreadCount(error) {
    if (error) {
      callback(error);
    } else {

      // style exception, too simple
      exports.findPosts(newBoard, userData, originalThread, newThreadId,
          function updatedPosts(error) {
            if (error) {
              exports.revertThreadCount(revertOps, error, callback);
            } else {
              callback();
            }
          });
      // style exception, too simple

    }

  });

};
// } Section 5: Thread count update

// from here, each part should send a different callback to the next part, so if
// a part fails, each part can perform its reversal action to guarantee data
// integrity
exports.updateThread = function(userData, parameters, originalThread, newBoard,
    cb) {

  var lastId = newBoard.lastPostId;

  var newThreadId = lastId - originalThread.postCount;

  var newLatestPosts = [];

  var startingPoint = lastId - originalThread.latestPosts.length + 1;

  for (var i = startingPoint; i <= lastId; i++) {
    newLatestPosts.push(i);
  }

  threads.updateOne({
    _id : originalThread._id
  }, {
    $set : {
      boardUri : parameters.boardUriDestination,
      threadId : newThreadId,
      latestPosts : newLatestPosts,
      files : exports.getAdjustedFiles(newBoard, originalThread,
          originalThread.files)
    },
    $unset : {
      flag : 1,
      flagName : 1,
      innerCache : 1,
      outerCache : 1,
      previewCache : 1,
      alternativeCaches : 1,
      clearCache : 1,
      hashedCache : 1
    }
  }, function updatedThread(error) {
    if (error) {
      cb(error);
    } else {

      // style exception, too simple
      exports.updateThreadCount(newBoard, userData, originalThread,
          newThreadId, function updatedThreadCount(error) {
            if (error) {
              exports.revertThread(originalThread, error, cb);
            } else {
              cb(null, newThreadId);
            }
          });
      // style exception, too simple

    }

  });

};

exports.transfer = function(userData, parameters, language, callback) {

  var globalStaff = userData.globalRole <= miscOps.getMaxStaffRole();

  if (!globalStaff) {
    callback(lang(language).errDeniedThreadTransfer);

    return;
  }

  parameters.threadId = +parameters.threadId;
  parameters.boardUri = parameters.boardUri.toString();
  parameters.boardUriDestination = parameters.boardUriDestination.toString();

  threads.findOne({
    threadId : parameters.threadId,
    boardUri : parameters.boardUri
  }, {
    projection : {
      postCount : 1,
      files : 1,
      latestPosts : 1,
      boardUri : 1,
      threadId : 1
    }
  }, function gotThread(error, thread) {
    if (error) {
      callback(error);
    } else if (!thread) {
      callback(lang(language).errThreadNotFound);
    } else {

      thread.latestPosts = thread.latestPosts || [];
      thread.postCount = thread.postCount || 0;

      // style exception, too simple
      boards.findOneAndUpdate({
        boardUri : parameters.boardUriDestination
      }, {
        $inc : {
          lastPostId : thread.postCount + 1
        }
      }, {
        returnOriginal : false
      }, function gotDestination(error, result) {
        if (error) {
          callback(error);
        } else if (!result.value) {
          callback(lang(language).errBoardNotFound);
        } else {
          exports.updateThread(userData, parameters, thread, result.value,
              callback);
        }
      });
      // style exception, too simple

    }
  });
};