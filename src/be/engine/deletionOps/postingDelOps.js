'use strict';

// handles manual postings deletion

var logger = require('../../logger');
var taskHandler = require('../../taskListener');
var db = require('../../db');
var posts = db.posts();
var threads = db.threads();
var globalLatestPosts = db.latestPosts();
var globalLatestImages = db.latestImages();
var boards = db.boards();
var reports = db.reports();
var globalLatestPostsCount;
var globalLatestImagesCount;
var latestPosts;
var common;
var wsEnabled;
var lang;
var overboard;
var redactedModNames;
var sfwOverboard;
var referenceHandler;
var boardOps;
var overboardOps;
var miscOps;
var logOps;

exports.loadSettings = function() {

  var settings = require('../../settingsHandler').getGeneralSettings();
  redactedModNames = settings.redactModNames;
  sfwOverboard = settings.sfwOverboard;
  wsEnabled = settings.wsPort || settings.wssPort;
  globalLatestPostsCount = settings.globalLatestPosts;
  globalLatestImagesCount = settings.globalLatestImages;
  latestPosts = settings.latestPostCount;
  overboard = settings.overboard;

};

exports.loadDependencies = function() {

  common = require('../postingOps').common;
  boardOps = require('../boardOps').meta;
  logOps = require('../logOps');
  referenceHandler = require('../mediaHandler');
  overboardOps = require('../overboardOps');
  lang = require('../langOps').languagePack;
  miscOps = require('../miscOps');

};

// Section 1: Posting deletion {
exports.reaggregateLatestPosts = function(countData, board, parentThreads,
    callback, index) {

  posts.aggregate([ {
    $match : {
      boardUri : board.boardUri,
      threadId : parentThreads[index]
    }
  }, {
    $project : {
      _id : 0,
      creation : 1,
      postId : 1
    }
  }, {
    $sort : {
      creation : -1
    }
  }, {
    $limit : latestPosts
  }, {
    $sort : {
      creation : 1
    }
  }, {
    $group : {
      _id : 0,
      ids : {
        $push : '$postId'
      }
    }
  } ]).toArray(function gotIds(error, results) {
    if (error) {
      callback(error);
    } else {

      var foundPosts = results.length ? results[0].ids : [];

      // style exception, too simple
      threads.updateOne({
        boardUri : board.boardUri,
        threadId : parentThreads[index]
      }, {
        $set : {
          fileCount : countData.fileCount,
          postCount : countData.postCount,
          latestPosts : foundPosts
        },
        $unset : {
          outerCache : 1,
          alternativeCaches : 1
        }
      }, function setPosts(error) {
        if (error) {
          callback(error);
        } else {
          exports.reaggregateThread(board, parentThreads, callback, ++index);
        }

      });
      // style exception, too simple

    }

  });
};

exports.reaggregateThread = function(board, parentThreads, callback, index) {

  index = index || 0;

  if (index >= parentThreads.length) {
    return callback();
  }

  posts.aggregate([ {
    $match : {
      boardUri : board.boardUri,
      threadId : parentThreads[index]
    }
  }, {
    $project : {
      _id : 0,
      fileCount : {
        $size : {
          $ifNull : [ '$files', [] ]
        }
      }
    }
  }, {
    $group : {
      _id : 0,
      postCount : {
        $sum : 1
      },
      fileCount : {
        $sum : '$fileCount'
      }
    }
  } ]).toArray(
      function gotResults(error, results) {

        if (error) {
          return callback(error);
        }

        var data = results.length ? results[0] : {
          postCount : 0,
          fileCount : 0
        };

        exports.reaggregateLatestPosts(data, board, parentThreads, callback,
            index);

      });

};

exports.signalAndLoop = function(parentThreads, board, foundThreads, rawPosts,
    callback) {

  for (var i = 0; i < parentThreads.length; i++) {
    var parentThread = parentThreads[i];

    process.send({
      board : board.boardUri,
      thread : parentThread
    });
  }

  for (i = 0; i < foundThreads.length; i++) {
    var thread = foundThreads[i];

    process.send({
      board : board.boardUri,
      thread : thread
    });
  }

  if (globalLatestImagesCount || globalLatestPostsCount) {
    process.send({
      frontPage : true
    });
  }

  process.send({
    multiboard : true,
    board : board.boardUri
  });

  process.send({
    board : board.boardUri
  });

  callback(null, foundThreads.length, rawPosts.length);
};

exports.reaggregateThreadForDeletion = function(board, parentThreads,
    foundThreads, rawPosts, callback) {

  exports.reaggregateThread(board, parentThreads, function reaggregated(error) {
    if (error) {
      callback(error);
    } else {
      exports.signalAndLoop(parentThreads, board, foundThreads, rawPosts,
          callback);
    }
  });

};

exports.updateBoardAndThreads = function(board, parameters, cb, foundThreads,
    rawPosts, parentThreads) {

  if (parameters.deleteUploads) {
    return exports.signalAndLoop(parentThreads, board, foundThreads, rawPosts,
        cb);
  }

  boardOps.aggregateThreadCount(board.boardUri, function aggregatedThreadCount(
      error) {

    if (error) {
      return cb(error);
    }

    exports.reaggregateThreadForDeletion(board, parentThreads, foundThreads,
        rawPosts, cb);

  });

};

exports.removeReportsAndGlobalLatestImages = function(board, parameters, cb,
    foundThreads, rawPosts, parentThreads) {

  var matchBlock = {
    boardUri : board.boardUri,
    $or : [ {
      threadId : {
        $in : foundThreads
      }
    }, {
      postId : {
        $in : rawPosts
      }
    } ]
  };

  globalLatestImages.removeMany(matchBlock, function removedLatesImages(error) {

    if (error) {
      return cb(error);
    }

    if (!parameters.deleteUploads) {

      // style exception, too simple
      reports.removeMany(matchBlock, function removedReports(error) {

        if (error) {
          cb(error);
        } else {
          exports.updateBoardAndThreads(board, parameters, cb, foundThreads,
              rawPosts, parentThreads);
        }

      });
      // style exception, too simple

    } else {
      exports.updateBoardAndThreads(board, parameters, cb, foundThreads,
          rawPosts, parentThreads);
    }

  });

};

exports.appendThreadDeletionLog = function(foundThreads) {

  var logMessage = '';

  if (foundThreads.length) {

    for (var i = 0; i < foundThreads.length; i++) {

      if (i) {
        logMessage += ',';
      }

      logMessage += ' ' + foundThreads[i];

    }

  }

  return logMessage;
};

exports.appendPostDeletionLog = function(foundPosts) {

  var logMessage = '';

  if (!foundPosts.length) {
    return logMessage;
  }

  for (var j = 0; j < foundPosts.length; j++) {

    var thread = foundPosts[j];

    for (var i = 0; i < thread.posts.length; i++) {

      if (i || j) {
        logMessage += ',';
      }

      logMessage += ' ' + thread._id + '/' + thread.posts[i];
    }
  }

  return logMessage;

};

exports.getLogMessage = function(parameters, foundThreads, foundPosts,
    userData, board) {

  var pieces = lang().logPostingDeletion;

  var startPiece = parameters.deleteUploads ? pieces.uploadStartPiece
      : pieces.startPiece;

  var logMessage = startPiece.replace('{$login}',
      redactedModNames ? lang().guiRedactedName : userData.login);

  var threadList = exports.appendThreadDeletionLog(foundThreads);

  if (threadList.length) {
    logMessage += pieces.threadPiece + threadList;
  }

  var postList = exports.appendPostDeletionLog(foundPosts);

  if (postList.length) {

    if (threadList.length) {
      logMessage += pieces.threadAndPostPiece;
    }

    logMessage += pieces.postPiece;

    logMessage += postList;

  }

  logMessage += pieces.endPiece.replace('{$board}', board.boardUri);

  return logMessage;

};

exports.logRemoval = function(userData, board, parameters, cb, foundThreads,
    rawPosts, foundPosts, parentThreads) {

  var logMessage = exports.getLogMessage(parameters, foundThreads, foundPosts,
      userData, board);

  logOps.insertLog({
    user : userData.login,
    type : parameters.deleteUploads ? 'fileDeletion' : 'deletion',
    time : new Date(),
    boardUri : board.boardUri,
    description : logMessage,
    global : userData.globalRole <= miscOps.getMaxStaffRole()
  }, function insertedLog() {

    exports.removeReportsAndGlobalLatestImages(board, parameters, cb,
        foundThreads, rawPosts, parentThreads);
  });

};

exports.removeGlobalLatestPosts = function(userData, board, parameters, cb,
    foundThreads, rawPosts, foundPosts, parentThreads) {

  var operations = [];

  if (foundThreads.length) {

    operations.push({
      deleteMany : {
        filter : {
          boardUri : board.boardUri,
          threadId : {
            $in : foundThreads
          }
        }
      }
    });

  }

  if (rawPosts.length) {

    operations.push({
      deleteMany : {
        filter : {
          boardUri : board.boardUri,
          postId : {
            $in : rawPosts
          }
        }
      }

    });

  }

  globalLatestPosts.bulkWrite(operations, function removedLatestPosts(error) {

    if (error) {
      cb(error);
    } else {

      if (userData) {

        exports.logRemoval(userData, board, parameters, cb, foundThreads,
            rawPosts, foundPosts, parentThreads);

      } else {

        exports.removeReportsAndGlobalLatestImages(board, parameters, cb,
            foundThreads, rawPosts, parentThreads);
      }
    }

  });

};

exports.applyNewBump = function(post, board, thread, parentThreads, callback,
    index) {

  if (!post) {

    threads.updateOne({
      boardUri : board.boardUri,
      threadId : parentThreads[index]
    }, {
      $set : {
        lastBump : thread.creation
      }
    }, function updated(error) {

      if (error) {
        callback(error);
      } else {
        exports.resetLastBump(board, parentThreads, callback, ++index);
      }

    });

  } else {

    threads.updateOne({
      boardUri : board.boardUri,
      threadId : parentThreads[index]
    }, {
      $set : {
        lastBump : post.creation
      }
    }, function updated(error) {

      if (error) {
        callback(error);
      } else {
        exports.resetLastBump(board, parentThreads, callback, ++index);
      }

    });

  }

};

exports.resetLastBump = function(board, parentThreads, callback, index) {

  index = index || 0;

  if (index >= parentThreads.length) {
    return callback();
  }

  threads.findOne({
    boardUri : board.boardUri,
    threadId : parentThreads[index]
  }, {
    projection : {
      creation : 1,
      autoSage : 1,
      _id : 0
    }
  }, function gotThread(error, thread) {

    if (error) {
      callback(error);
    } else if (!thread || thread.autoSage) {
      exports.resetLastBump(board, parentThreads, callback, ++index);
    } else {

      var matchBlock = {
        boardUri : board.boardUri,
        threadId : parentThreads[index],
        email : {
          $ne : 'sage'
        }
      };

      if (board.maxBumpAgeDays) {

        var maxAge = new Date(thread.creation);

        maxAge.setUTCDate(maxAge.getUTCDate() + board.maxBumpAgeDays);
        matchBlock.creation = {
          $lte : maxAge
        };

      }

      // style exception, too simple
      posts.find(matchBlock, {
        projection : {
          creation : 1,
          _id : 0
        }
      }).sort({
        creation : -1
      }).limit(1).toArray(
          function gotLastPost(error, foundPosts) {

            if (error) {
              callback(error);
            } else {

              exports.applyNewBump(foundPosts[0], board, thread, parentThreads,
                  callback, index);

            }

          });
      // style exception, too simple

    }
  });

};

exports.updateThreadPages = function(userData, board, parameters, cb,
    foundThreads, rawPosts, foundPosts, parentThreads) {

  exports.resetLastBump(board, parentThreads, function resetBumps(error) {

    if (error) {
      cb(error);
    } else {

      common.setThreadsPage(board.boardUri, function update(error) {

        if (error) {
          console.log(error);
        }

        exports.removeGlobalLatestPosts(userData, board, parameters, cb,
            foundThreads, rawPosts, foundPosts, parentThreads);

      });

    }

  });

};

exports.wsNotify = function(boardUri, foundPosts, parentThreads, uploads) {

  if (!wsEnabled) {
    return;
  }

  for (var i = 0; i < foundPosts.length; i++) {

    var post = foundPosts[i];

    if (!uploads && parentThreads.indexOf(post._id) < 0) {
      continue;
    }

    taskHandler.sendToSocket(null, {
      type : 'notifySockets',
      threadId : post._id,
      boardUri : boardUri,
      target : post.posts,
      action : 'delete'
    });

  }

};

exports.removeFoundContent = function(userData, board, parameters, cb,
    foundThreads, rawPosts, foundPosts, parentThreads) {

  exports.wsNotify(board.boardUri, foundPosts, parentThreads,
      parameters.deleteUploads);

  if (parameters.deleteUploads) {

    if (userData) {
      exports.logRemoval(userData, board, parameters, cb, foundThreads,
          rawPosts, foundPosts, parentThreads);
    } else {
      exports.removeReportsAndGlobalLatestImages(board, parameters, cb,
          foundThreads, rawPosts, parentThreads);
    }

    return;

  }

  threads.deleteMany({
    boardUri : board.boardUri,
    threadId : {
      $in : foundThreads
    }
  }, function removedThreads(error) {
    if (error) {
      return cb(error);
    }

    // style exception, too simple
    posts.deleteMany({
      boardUri : board.boardUri,
      postId : {
        $in : rawPosts
      }
    }, function removedPosts(error) {
      if (error) {
        cb(error);
      } else {

        exports.updateThreadPages(userData, board, parameters, cb,
            foundThreads, rawPosts, foundPosts, parentThreads);

      }

    });
    // style exception, too simple

  });

};

exports.isAllowedByStaffPower = function(userData, board) {

  var isOwner;
  var isVolunteer;
  var isOnGLobalStaff;

  if (userData) {
    isOwner = board.owner === userData.login;

    if (board.volunteers) {
      isVolunteer = board.volunteers.indexOf(userData.login) > -1;
    }

    isOnGLobalStaff = userData.globalRole <= miscOps.getMaxStaffRole();

  }

  return isOwner || isVolunteer || isOnGLobalStaff;

};

exports.composeQueryBlock = function(board, threadsToDelete, userData,
    parameters, callback) {

  var threadQueryBlock = {
    boardUri : board.boardUri,
    threadId : {
      $in : threadsToDelete[board.boardUri] || []
    }
  };

  if (parameters.deleteUploads) {
    threadQueryBlock['files.0'] = {
      $exists : true
    };
  }

  if (!exports.isAllowedByStaffPower(userData, board)) {
    if (!parameters.password) {
      return false;
    } else {
      threadQueryBlock.password = parameters.password;
    }
  }

  return threadQueryBlock;
};

exports.sanitizeParentThreads = function(foundThreads, rawParents) {

  var parents = [];

  for (var i = 0; i < rawParents.length; i++) {
    var parent = rawParents[i];

    if (foundThreads.indexOf(parent) === -1) {
      parents.push(parent);
    }
  }

  return parents;

};

exports.getPostsToDelete = function(userData, board, postsToDelete, parameters,
    language, cb, foundThreads, queryBlock) {

  if (parameters.deleteUploads) {

    queryBlock = {
      postId : {
        $in : postsToDelete[board.boardUri] || []
      },
      'files.0' : {
        $exists : true
      }
    };

    if (!exports.isAllowedByStaffPower(userData, board)) {
      if (!parameters.password) {
        cb();
        return;
      } else {
        queryBlock.password = parameters.password;
      }
    }

  } else {

    var orBlock = [ {
      threadId : {
        $in : foundThreads
      }
    }, {
      postId : {
        $in : postsToDelete[board.boardUri] || []
      }
    } ];

    if (queryBlock.password) {
      orBlock[1].password = queryBlock.password;
      delete queryBlock.password;
    }

    queryBlock.$or = orBlock;

    delete queryBlock.threadId;
  }

  posts.aggregate([ {
    $match : queryBlock
  }, {
    $project : {
      _id : 0,
      postId : 1,
      threadId : 1
    }
  }, {
    $group : {
      _id : '$threadId',
      posts : {
        $push : '$postId'
      }
    }
  } ]).toArray(
      function gotPosts(error, foundPosts) {

        if (error) {
          return cb(error);
        }

        if (!foundPosts.length && !foundThreads.length) {
          return cb();
        }

        var parentThreads = [];
        var rawPosts = [];

        for (var i = 0; i < foundPosts.length; i++) {
          parentThreads.push(foundPosts[i]._id);

          rawPosts = rawPosts.concat(foundPosts[i].posts);

        }

        parentThreads = exports.sanitizeParentThreads(foundThreads,
            parentThreads);

        // style exception, too simple
        referenceHandler.clearPostingReferences(board.boardUri, foundThreads,
            rawPosts, parameters.deleteUploads, parameters.deleteMedia,
            userData, language, function clearedReferences(error) {

              if (error) {
                return cb(error);
              }

              exports.removeFoundContent(userData, board, parameters, cb,
                  foundThreads, rawPosts, foundPosts, parentThreads);

            });
        // style exception, too simple

      });

};

exports.getThreadsToDelete = function(userData, board, threadsToDelete,
    postsToDelete, parameters, language, callback) {

  var threadQueryBlock = exports.composeQueryBlock(board, threadsToDelete,
      userData, parameters);

  if (!threadQueryBlock) {
    callback();
    return;
  }

  threads.aggregate([ {
    $match : threadQueryBlock
  }, {
    $project : {
      _id : 0,
      threadId : 1
    }
  }, {
    $group : {
      _id : 0,
      threads : {
        $push : '$threadId'
      }
    }
  } ]).toArray(
      function gotThreads(error, results) {
        if (error) {
          callback(error);
        } else {

          var foundThreads = results.length ? results[0].threads : [];

          exports.getPostsToDelete(userData, board, postsToDelete, parameters,
              language, callback, foundThreads, threadQueryBlock);
        }
      });

};

exports.iterateBoardsToDelete = function(userData, parameters, threadsToDelete,
    postsToDelete, foundBoards, language, callback, removedThreadsSoFar,
    removedPostsSoFar) {

  removedThreadsSoFar = removedThreadsSoFar || 0;
  removedPostsSoFar = removedPostsSoFar || 0;

  if (!foundBoards.length) {

    if (overboard || sfwOverboard) {
      overboardOps.reaggregate({
        overboard : true,
        reaggregate : true
      });
    }

    callback(null, removedThreadsSoFar, removedPostsSoFar);
    return;
  }

  boards.findOne({
    boardUri : foundBoards.shift()
  }, {
    projection : {
      boardUri : 1,
      owner : 1,
      _id : 0,
      settings : 1,
      volunteers : 1,
      maxBumpAgeDays : 1
    }
  }, function gotBoard(error, board) {

    if (error) {
      callback(error);
    } else if (!board) {
      callback(lang(language).errBoardNotFound);
    } else {
      var settings = board.settings || [];

      if (!userData && settings.indexOf('blockDeletion') > -1) {
        exports.iterateBoardsToDelete(userData, parameters, threadsToDelete,
            postsToDelete, foundBoards, language, callback);

        return;
      }

      exports.getThreadsToDelete(userData, board, threadsToDelete,
          postsToDelete, parameters, language, function removedBoardPostings(
              error, removedThreadsCount, removedPostsCount) {

            if (error) {
              callback(error);
            } else {

              removedThreadsSoFar += removedThreadsCount || 0;
              removedPostsSoFar += removedPostsCount || 0;

              exports.iterateBoardsToDelete(userData, parameters,
                  threadsToDelete, postsToDelete, foundBoards, language,
                  callback, removedThreadsSoFar, removedPostsSoFar);
            }
          });
    }

  });

};

exports.printAuth = function(userData, parameters, threadsToDelete,
    postsToDelete) {
  if (parameters.password) {
    console.log('Using password ' + parameters.password);
  }

  if (userData) {
    console.log('User identification ' + JSON.stringify(userData, null, 2));
  }

  console.log('Deleting threads: ' + JSON.stringify(threadsToDelete, null, 2));
  console.log('Deleting posts: ' + JSON.stringify(postsToDelete, null, 2));
};

exports.adjustMediaDeletion = function(parameters, userData) {

  if (parameters.deleteMedia) {

    if (!userData) {
      parameters.deleteMedia = false;
    } else {
      parameters.deleteMedia = userData.globalRole <= miscOps.getMaxStaffRole();
    }

  }

};

exports.posting = function(userData, parameters, threadsToDelete,
    postsToDelete, language, callback) {

  var foundBoards = [];

  exports.adjustMediaDeletion(parameters, userData);

  for ( var key in threadsToDelete) {

    if (threadsToDelete.hasOwnProperty(key)) {
      if (foundBoards.indexOf(key) === -1) {
        foundBoards.push(key);
      }
    }

  }

  for (key in postsToDelete) {

    if (postsToDelete.hasOwnProperty(key)) {
      if (foundBoards.indexOf(key) === -1) {
        foundBoards.push(key);
      }
    }

  }

  exports.iterateBoardsToDelete(userData, parameters, threadsToDelete,
      postsToDelete, foundBoards, language, callback);

};
// } Section 1: Posting deletion
