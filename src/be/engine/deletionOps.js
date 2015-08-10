'use strict';

// handles any operation regarding logic of deletion, including gridFs files

var db = require('../db');
var files = db.files();
var users = db.users();
var reports = db.reports();
var posts = db.posts();
var threads = db.threads();
var logs = db.logs();
var miscOps = require('./miscOps');
var gridFs = require('./gridFsHandler');
var logger = require('../logger');
var boards = db.boards();
var lang = require('./langOps').languagePack();
var boot = require('../boot');
var flags = db.flags();
var boardStats = db.stats();
var bans = db.bans();
var hashBans = db.hashBans();
var settings = boot.getGeneralSettings();
var verbose = settings.verbose;
var threadLimit = settings.maxThreadCount;
var latestPosts = settings.latestPostCount;

var collectionsToClean = [ reports, posts, threads, flags, hashBans,
    boardStats, bans ];

function removeThreads(boardUri, threadsToDelete, callback) {

  threads.remove({
    boardUri : boardUri,
    threadId : {
      $in : threadsToDelete
    }
  }, function removedThreads(error, result) {

    if (error) {
      callback(error);
    } else {

      // style exception, too simple
      boards.update({
        boardUri : boardUri
      }, {
        $inc : {
          threadCount : -threadsToDelete.length
        }
      }, function updatedThreadCount(error) {
        callback(error);
      });

      // style exception, too simple

    }

  });

}

function getThreadFilesToRemove(boardUri, threadsToRemove, callback) {

  files.aggregate([ {
    $match : {
      'metadata.boardUri' : boardUri,
      'metadata.threadId' : {
        $in : threadsToRemove
      }
    }
  }, {
    $group : {
      _id : 0,
      files : {
        $push : '$filename'
      }
    }
  } ], function gotFilesToDelete(error, filesToDelete) {
    if (error) {
      callback(error);
    } else if (!filesToDelete.length) {
      callback();
    } else {

      // style exception, too simple
      gridFs.removeFiles(filesToDelete[0].files, function deletedFiles(error) {
        if (error) {
          callback(error);
        } else {
          removeThreads(boardUri, threadsToRemove, callback);
        }
      });

      // style exception, too simple

    }
  });

}

exports.cleanThreads = function(boardUri, callback) {

  if (verbose) {
    console.log('Cleaning threads of ' + boardUri);
  }

  threads.aggregate([ {
    $match : {
      boardUri : boardUri
    }
  }, {
    $sort : {
      pinned : -1,
      lastBump : -1
    }
  }, {
    $skip : threadLimit
  }, {
    $group : {
      _id : 0,
      threads : {
        $push : '$threadId'
      }
    }
  } ], function gotThreads(error, threadsToRemove) {
    if (error) {
      callback(error);
    } else if (!threadsToRemove.length) {
      callback();
    } else {
      getThreadFilesToRemove(boardUri, threadsToRemove[0].threads, callback);
    }
  });

};

// start of content deletion process (wild ride ahead)
function reaggregateLatestPosts(countData, board, parentThreads, callback,
    index) {
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
  } ], function gotIds(error, results) {
    if (error) {
      callback(error);
    } else {

      var foundPosts = results.length ? results[0].ids : [];

      // style exception, too simple

      threads.update({
        boardUri : board.boardUri,
        threadId : parentThreads[index]
      }, {
        $set : {
          fileCount : countData.fileCount,
          postCount : countData.postCount,
          latestPosts : foundPosts
        }
      }, function setPosts(error) {
        if (error) {
          callback(error);
        } else {
          reaggregateThread(board, parentThreads, callback, index + 1);
        }

      });

      // style exception, too simple

    }

  });
}

function reaggregateThread(board, parentThreads, callback, index) {

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
  } ], function gotResults(error, results) {

    if (error) {
      callback(error);
    } else {

      var data = results.length ? results[0] : {
        postCount : 0,
        fileCount : 0
      };

      reaggregateLatestPosts(data, board, parentThreads, callback, index);
    }

  });

}

function signalAndLoop(parentThreads, board, userData, parameters,
    threadsToDelete, postsToDelete, foundBoards, callback) {

  for (var i = 0; i < parentThreads.length; i++) {
    var parentThread = parentThreads[i];

    process.send({
      board : board.boardUri,
      thread : parentThread
    });
  }

  process.send({
    board : board.boardUri
  });

  iterateBoardsToDelete(userData, parameters, threadsToDelete, postsToDelete,
      foundBoards, callback);
}

function updateBoardAndThreads(userData, board, threadsToDelete, postsToDelete,
    parameters, foundBoards, callback, foundThreads, parentThreads) {

  boards.update({
    boardUri : board.boardUri
  }, {
    $inc : {
      threadCount : -foundThreads.length
    }
  }, function updatedThreadCount(error) {
    if (error) {
      callback(error);
    } else {
      // style exception, too simple
      reaggregateThread(board, parentThreads, function reaggregated(error) {
        if (error) {
          callback(error);
        } else {
          signalAndLoop(parentThreads, board, userData, parameters,
              threadsToDelete, postsToDelete, foundBoards, callback);

        }
      });
      // style exception, too simple
    }

  });

}

function removeContentFiles(userData, board, threadsToDelete, postsToDelete,
    parameters, foundBoards, cb, foundThreads, foundPosts, parentThreads) {

  files.aggregate([ {
    $match : {
      'metadata.boardUri' : board.boardUri,
      $or : [ {
        'metadata.threadId' : {
          $in : foundThreads
        }
      }, {
        'metadata.postId' : {
          $in : foundPosts
        }
      } ]
    }
  }, {
    $group : {
      _id : 0,
      files : {
        $push : '$filename'
      }
    }
  } ], function gotFiles(error, results) {
    if (error) {
      cb(error);
    } else {
      if (results.length) {

        // style exception, too simple
        gridFs.removeFiles(results[0].files, function deletedFiles(error) {
          if (error) {
            cb(error);
          } else {
            updateBoardAndThreads(userData, board, threadsToDelete,
                postsToDelete, parameters, foundBoards, cb, foundThreads,
                parentThreads);
          }
        });
        // style exception, too simple
      } else {
        updateBoardAndThreads(userData, board, threadsToDelete, postsToDelete,
            parameters, foundBoards, cb, foundThreads, parentThreads);
      }
    }
  });

}

function appendThreadDeletionLog(foundThreads) {

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
}

function appendPostDeletionLog(foundThreads, foundPosts) {

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

}

function logRemoval(userData, board, threadsToDelete, postsToDelete,
    parameters, foundBoards, cb, foundThreads, foundPosts, parentThreads) {

  var pieces = lang.logPostingDeletion;

  var logMessage = pieces.startPiece.replace('{$login}', userData.login);

  var threadList = appendThreadDeletionLog(foundThreads);

  if (threadList.length) {
    logMessage += pieces.threadPiece + threadList;
  }

  var postList = appendPostDeletionLog(foundThreads, foundPosts);

  if (postList.length) {

    if (threadList.length) {
      logMessage += pieces.threadAndPostPiece;
    }

    logMessage += pieces.postPiece;

    logMessage += postList;

  }

  logMessage += pieces.endPiece.replace('{$board}', board.boardUri);

  logs.insert({
    user : userData.login,
    type : 'deletion',
    time : new Date(),
    boardUri : board.boardUri,
    description : logMessage,
    global : userData.globalRole <= miscOps.getMaxStaffRole()
  }, function insertedLog(error) {

    if (error) {

      logger.printLogError(logMessage, error);
    }

    removeContentFiles(userData, board, threadsToDelete, postsToDelete,
        parameters, foundBoards, cb, foundThreads, foundPosts, parentThreads);
  });
}

function removeFoundContent(userData, board, threadsToDelete, postsToDelete,
    parameters, foundBoards, cb, foundThreads, foundPosts, parentThreads) {

  threads.remove({
    boardUri : board.boardUri,
    threadId : {
      $in : foundThreads
    }
  }, function removedThreads(error) {
    if (error) {
      cb(error);
    } else {
      // style exception, too simple

      posts.remove({
        boardUri : board.boardUri,
        postId : {
          $in : foundPosts
        }
      }, function removedPosts(error) {
        if (error) {
          cb(error);
        } else {
          if (userData) {

            logRemoval(userData, board, threadsToDelete, postsToDelete,
                parameters, foundBoards, cb, foundThreads, foundPosts,
                parentThreads, userData);

          } else {

            removeContentFiles(userData, board, threadsToDelete, postsToDelete,
                parameters, foundBoards, cb, foundThreads, foundPosts,
                parentThreads);
          }
        }

      });

      // style exception, too simple
    }

  });

}

function composeQueryBlock(board, threadsToDelete, userData, parameters,
    callback) {
  var threadQueryBlock = {
    boardUri : board.boardUri,
    threadId : {
      $in : threadsToDelete[board.boardUri] || []
    }
  };

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

  if (!isOwner && !isVolunteer && !isOnGLobalStaff) {
    if (!parameters.password) {
      return false;
    } else {
      threadQueryBlock.password = parameters.password;
    }
  }

  return threadQueryBlock;
}

function sanitizeParentThreads(foundThreads, rawParents) {

  var parents = [];

  for (var i = 0; i < rawParents.length; i++) {
    var parent = rawParents[i];

    if (foundThreads.indexOf(parent) === -1) {
      parents.push(parent);
    }
  }

  return parents;

}

function getPostsToDelete(userData, board, threadsToDelete, postsToDelete,
    parameters, foundBoards, callback, foundThreads, queryBlock) {

  var orBlock = [ {
    threadId : queryBlock.threadId
  }, {
    postId : {
      $in : postsToDelete[board.boardUri] || []
    }
  } ];

  queryBlock.$or = orBlock;

  delete queryBlock.threadId;

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
  } ], function gotPosts(error, results) {
    if (error) {
      callback(error);
    } else {
      var foundPosts = results.length ? results[0].posts : [];

      var parentThreads = results.length ? sanitizeParentThreads(foundThreads,
          results[0].parentThreads) : [];

      removeFoundContent(userData, board, threadsToDelete, postsToDelete,
          parameters, foundBoards, callback, foundThreads, foundPosts,
          parentThreads);
    }
  });

}

function getThreadsToDelete(userData, board, threadsToDelete, postsToDelete,
    parameters, foundBoards, callback) {

  var threadQueryBlock = composeQueryBlock(board, threadsToDelete, userData,
      parameters);

  if (!threadQueryBlock) {
    iterateBoardsToDelete(userData, parameters, threadsToDelete, postsToDelete,
        foundBoards, callback);
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
  } ], function gotThreads(error, results) {
    if (error) {
      callback(error);
    } else {
      var foundThreads = results.length ? results[0].threads : [];

      getPostsToDelete(userData, board, threadsToDelete, postsToDelete,
          parameters, foundBoards, callback, foundThreads, threadQueryBlock);
    }
  });

}

function iterateBoardsToDelete(userData, parameters, threadsToDelete,
    postsToDelete, foundBoards, callback) {

  if (!foundBoards.length) {
    callback();
    return;
  }

  boards.findOne({
    boardUri : foundBoards.shift()
  }, {
    boardUri : 1,
    owner : 1,
    _id : 0,
    volunteers : 1
  }, function gotBoard(error, board) {

    if (error) {
      callback(error);
    } else if (!board) {
      callback(lang.errBoardNotFound);
    } else {
      getThreadsToDelete(userData, board, threadsToDelete, postsToDelete,
          parameters, foundBoards, callback);
    }

  });

}

function printAuth(userData, parameters, threadsToDelete, postsToDelete) {
  if (parameters.password) {
    console.log('Using password ' + parameters.password);
  }

  if (userData) {
    console.log('User identification ' + JSON.stringify(userData, null, 2));
  }

  console.log('Deleting threads: ' + JSON.stringify(threadsToDelete, null, 2));
  console.log('Deleting posts: ' + JSON.stringify(postsToDelete, null, 2));
}

exports.posting = function(userData, parameters, threadsToDelete,
    postsToDelete, callback) {

  var foundBoards = [];

  if (verbose) {

    printAuth(userData, parameters, threadsToDelete, postsToDelete);
  }

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

  iterateBoardsToDelete(userData, parameters, threadsToDelete, postsToDelete,
      foundBoards, callback);

};
// end of content deletion process ( hope you enjoyed your ride)

// start of board deletion
function deleteBoardContent(board, callback, index) {
  index = index || 0;

  if (index < collectionsToClean.length) {

    collectionsToClean[index].remove({
      boardUri : board
    }, function removedData(error) {
      deleteBoardContent(board, callback, index + 1);

    });

  } else {
    process.send({
      frontPage : true
    });

    callback();
  }

}

function deleteBoardFiles(board, callback) {

  files.aggregate([ {
    $match : {
      'metadata.boardUri' : board.boardUri
    }
  }, {
    $group : {
      _id : 0,
      files : {
        $push : '$filename'
      }
    }
  } ], function gotFiles(error, results) {
    if (error) {
      callback(error);
    } else {

      // style exception, too simple
      gridFs.removeFiles(results[0].files, function deletedFiles(error) {

        if (error) {
          callback(error);
        } else {
          deleteBoardContent(board.boardUri, callback);
        }

      });
      // style exception, too simple

    }
  });

}

function logBoardDeletion(board, user, callback) {

  var message = lang.logBoardDeletion.replace('{$board}', board.boardUri)
      .replace('{$login}', user);

  logs.insert({
    type : 'boardDeletion',
    user : user,
    time : new Date(),
    boardUri : board.boardUri,
    description : message,
    global : true
  }, function insertedLog(error) {

    if (error) {
      logger.printLogError(message, error);
    }

    deleteBoardFiles(board, callback);

  });
}

function deleteBoard(board, user, callback) {

  boards.remove({
    boardUri : board.boardUri
  }, function removedBoard(error) {
    if (error) {
      callback(error);
    } else {

      // style exception, too simple
      users.update({
        login : board.owner
      }, {
        $pull : {
          ownedBoards : board.boardUri
        }
      }, function updatedUserBoards(error) {
        if (error) {
          callback(error);
        } else {
          logBoardDeletion(board, user, callback);
        }
      });

      // style exception, too simple

    }
  });

}

exports.board = function(userData, boardUri, callback) {

  var admin = userData.globalRole < 2;

  boards.findOne({
    boardUri : boardUri
  }, {
    _id : 0,
    boardUri : 1,
    owner : 1
  }, function gotBoard(error, board) {
    if (error) {
      callback(error);
    } else if (!board) {
      callback(lang.errBoardNotFound);
    } else if (board.owner !== userData.login && !admin) {
      callback(lang.errDeniedBoardDeletion);
    } else {
      deleteBoard(board, userData.login, callback);
    }
  });

};
// end of board deletion

// start of early 404 cleanup
function removeEarly404Files(results, callback) {

  var orArray = [];

  var operations = [];

  var genQueue = require('../generationQueue');

  for (var i = 0; i < results.length; i++) {
    var board = results[i];

    genQueue.queue({
      board : board._id
    });

    operations.push({
      updateOne : {
        filter : {
          boardUri : board._id
        },
        update : {
          $inc : {
            threadCount : -board.threads.length
          }
        }
      }
    });

    orArray.push({
      'metadata.boardUri' : board._id,
      'metadata.threadId' : {
        $in : board.threads
      }
    });
  }

  files.aggregate([ {
    $match : {
      $or : orArray
    }
  }, {
    $group : {
      _id : 0,
      files : {
        $addToSet : '$filename'
      }
    }
  } ], function gotFiles(error, results) {
    if (error) {
      callback(error);
    } else {

      // style exception, too simple
      gridFs.removeFiles(results[0].files, function deletedFiles(error) {

        if (error) {
          callback(error);
        } else {
          boards.bulkWrite(operations, callback);
        }

      });
      // style exception, too simple

    }
  });
}

function removeEarly404Posts(results, callback) {

  if (verbose) {
    var msg = 'Cleaning threads for early 404: ';
    msg += JSON.stringify(results, null, 2);
    console.log(msg);
  }

  var orArray = [];

  for (var i = 0; i < results.length; i++) {
    var board = results[i];

    orArray.push({
      boardUri : board._id,
      threadId : {
        $in : board.threads
      }
    });
  }

  threads.deleteMany({
    $or : orArray
  }, function removedThreads(error) {
    if (error) {
      callback(error);
    } else {

      // style exception, too simple
      posts.deleteMany({
        $or : orArray
      }, function removedPosts(error) {
        if (error) {
          callback(error);
        } else {
          removeEarly404Files(results, callback);
        }
      });
      // style exception, too simple

    }
  });

}

exports.cleanEarly404 = function(callback) {

  boards.aggregate([ {
    $match : {
      settings : {
        $elemMatch : {
          $eq : 'early404'
        }
      }
    }
  }, {
    $group : {
      _id : 0,
      boards : {
        $addToSet : '$boardUri'
      }
    }
  } ], function gotBoards(error, results) {
    if (!results || !results.length) {
      callback(error);
    } else {

      var oldestAge = new Date(new Date().getTime() - (1000 * 60 * 60));

      // style exception, too simple
      threads.aggregate([ {
        $match : {
          postCount : {
            $not : {
              $gte : 5
            }
          },
          boardUri : {
            $in : results[0].boards
          },
          creation : {
            $lte : oldestAge
          }
        }

      }, {
        $group : {
          _id : '$boardUri',
          threads : {
            $addToSet : '$threadId'
          }
        }
      } ], function gotThreads(error, results) {
        if (!results || !results.length) {
          callback(error);
        } else {
          removeEarly404Posts(results, callback);
        }
      });
      // style exception, too simple

    }
  });

};
// end of early 404 cleanup
