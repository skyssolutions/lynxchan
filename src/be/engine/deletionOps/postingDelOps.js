'use strict';

// handles manual postings deletion

var logger = require('../../logger');
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
var lang;
var overboard;
var sfwOverboard;
var referenceHandler;
var boardOps;
var overboardOps;
var miscOps;
var logOps;

exports.loadSettings = function() {

  var settings = require('../../settingsHandler').getGeneralSettings();

  sfwOverboard = settings.sfwOverboard;
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
          outerCache : 1
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
    callback();
    return;
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
          callback(error);
        } else {

          var data = results.length ? results[0] : {
            postCount : 0,
            fileCount : 0
          };

          exports.reaggregateLatestPosts(data, board, parentThreads, callback,
              index);
        }

      });

};

exports.signalAndLoop = function(parentThreads, board, parameters,
    foundThreads, foundPosts, callback) {

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

  callback(null, foundThreads.length, foundPosts.length);
};

exports.reaggregateThreadForDeletion = function(board, parentThreads,
    parameters, foundThreads, foundPosts, callback) {

  exports.reaggregateThread(board, parentThreads, function reaggregated(error) {
    if (error) {
      callback(error);
    } else {
      exports.signalAndLoop(parentThreads, board, parameters, foundThreads,
          foundPosts, callback);
    }
  });

};

exports.updateBoardAndThreads = function(board, parameters, cb, foundThreads,
    foundPosts, parentThreads) {

  if (!parameters.deleteUploads) {

    boardOps.aggregateThreadCount(board.boardUri,
        function aggregatedThreadCount(error) {

          if (error) {
            cb(error);
          } else {
            exports.reaggregateThreadForDeletion(board, parentThreads,
                parameters, foundThreads, foundPosts, cb);
          }

        });

  } else {
    exports.signalAndLoop(parentThreads, board, parameters, foundThreads,
        foundPosts, cb);
  }

};

exports.removeReportsAndGlobalLatestImages = function(board, parameters, cb,
    foundThreads, foundPosts, parentThreads) {

  var matchBlock = {
    boardUri : board.boardUri,
    $or : [ {
      threadId : {
        $in : foundThreads
      }
    }, {
      postId : {
        $in : foundPosts
      }
    } ]
  };

  globalLatestImages.removeMany(matchBlock, function removedLatesImages(error) {

    if (error) {
      cb(error);
    } else {

      if (!parameters.deleteUploads) {

        // style exception, too simple
        reports.removeMany(matchBlock, function removedReports(error) {

          if (error) {
            cb(error);
          } else {
            exports.updateBoardAndThreads(board, parameters, cb, foundThreads,
                foundPosts, parentThreads);
          }

        });
        // style exception, too simple

      } else {
        exports.updateBoardAndThreads(board, parameters, cb, foundThreads,
            foundPosts, parentThreads);
      }

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

exports.appendPostDeletionLog = function(foundThreads, foundPosts) {

  var logMessage = '';

  if (foundPosts.length) {

    for (var i = 0; i < foundPosts.length; i++) {
      if (i) {
        logMessage += ',';
      }

      logMessage += ' ' + foundPosts[i];
    }

  }

  return logMessage;

};

exports.getLogMessage = function(parameters, foundThreads, foundPosts,
    userData, board) {

  var pieces = lang().logPostingDeletion;

  var startPiece = parameters.deleteUploads ? pieces.uploadStartPiece
      : pieces.startPiece;

  var logMessage = startPiece.replace('{$login}', userData.login);

  var threadList = exports.appendThreadDeletionLog(foundThreads);

  if (threadList.length) {
    logMessage += pieces.threadPiece + threadList;
  }

  var postList = exports.appendPostDeletionLog(foundThreads, foundPosts);

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
    foundPosts, parentThreads) {

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
        foundThreads, foundPosts, parentThreads);
  });

};

exports.removeGlobalLatestPosts = function(userData, board, parameters, cb,
    foundThreads, foundPosts, parentThreads) {

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

  if (foundPosts.length) {

    operations.push({
      deleteMany : {
        filter : {
          boardUri : board.boardUri,
          postId : {
            $in : foundPosts
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
            foundPosts, parentThreads);

      } else {

        exports.removeReportsAndGlobalLatestImages(board, parameters, cb,
            foundThreads, foundPosts, parentThreads);
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
    callback();
    return;
  }

  threads.findOne({
    boardUri : board.boardUri,
    threadId : parentThreads[index]
  }, {
    projection : {
      creation : 1,
      _id : 0
    }
  }, function gotThread(error, thread) {

    if (error) {
      callback(error);
    } else if(!thread){
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
    foundThreads, foundPosts, parentThreads) {

  exports.resetLastBump(board, parentThreads, function resetBumps(error) {

    if (error) {
      cb(error);
    } else {

      common.setThreadsPage(board.boardUri, function update(error) {

        if (error) {
          console.log(error);
        }

        exports.removeGlobalLatestPosts(userData, board, parameters, cb,
            foundThreads, foundPosts, parentThreads);

      });

    }

  });

};

exports.removeFoundContent = function(userData, board, parameters, cb,
    foundThreads, foundPosts, parentThreads) {

  if (parameters.deleteUploads) {
    threads.updateMany({
      boardUri : board.boardUri,
      threadId : {
        $in : foundThreads
      }
    }, {
      $set : {
        files : []
      },
      $unset : {
        innerCache : 1,
        outerCache : 1,
        previewCache : 1,
        clearCache : 1,
        alternativeCaches : 1,
        hashedCache : 1
      }
    }, function removedThreadFiles(error) {
      if (error) {
        cb(error);
      } else {

        // style exception, too simple
        posts.updateMany({
          boardUri : board.boardUri,
          postId : {
            $in : foundPosts
          }
        }, {
          $set : {
            files : []
          },
          $unset : {
            innerCache : 1,
            outerCache : 1,
            previewCache : 1,
            alternativeCaches : 1,
            clearCache : 1,
            hashedCache : 1
          }
        }, function removedPostFiles(error) {
          if (error) {
            cb(error);
          } else {
            if (userData) {

              exports.logRemoval(userData, board, parameters, cb, foundThreads,
                  foundPosts, parentThreads);

            } else {

              exports.removeReportsAndGlobalLatestImages(board, parameters, cb,
                  foundThreads, foundPosts, parentThreads);
            }
          }
        });
        // style exception, too simple

      }
    });

  } else {

    threads.deleteMany({
      boardUri : board.boardUri,
      threadId : {
        $in : foundThreads
      }
    }, function removedThreads(error) {
      if (error) {
        cb(error);
      } else {

        // style exception, too simple
        posts.deleteMany({
          boardUri : board.boardUri,
          postId : {
            $in : foundPosts
          }
        }, function removedPosts(error) {
          if (error) {
            cb(error);
          } else {

            exports.updateThreadPages(userData, board, parameters, cb,
                foundThreads, foundPosts, parentThreads);

          }

        });
        // style exception, too simple

      }

    });
  }

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
      threadId : queryBlock.threadId
    }, {
      postId : {
        $in : postsToDelete[board.boardUri] || []
      }
    } ];

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
      _id : 0,
      posts : {
        $push : '$postId'
      },
      parentThreads : {
        $addToSet : '$threadId'
      }
    }
  } ]).toArray(
      function gotPosts(error, results) {
        if (error) {
          cb(error);
        } else {
          var foundPosts = results.length ? results[0].posts : [];

          if (!foundPosts.length && !foundThreads.length) {
            cb();
            return;
          }

          var parentThreads = results.length ? exports.sanitizeParentThreads(
              foundThreads, results[0].parentThreads) : [];

          // style exception, too simple
          referenceHandler.clearPostingReferences(board.boardUri, foundThreads,
              foundPosts, parameters.deleteUploads, parameters.deleteMedia,
              userData, language, function clearedReferences(error) {

                if (error) {
                  cb(error);
                } else {
                  exports.removeFoundContent(userData, board, parameters, cb,
                      foundThreads, foundPosts, parentThreads);
                }

              });
          // style exception, too simple

        }
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
