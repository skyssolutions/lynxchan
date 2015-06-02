'use strict';

// handles any operation regarding logic of deletion, including gridFs files

var db = require('../db');
var files = db.files();
var users = db.users();
var posts = db.posts();
var threads = db.threads();
var miscOps = require('./miscOps');
var gridFs = require('./gridFsHandler');
var boards = db.boards();
var settings = require('../boot').getGeneralSettings();
var verbose = settings.verbose;
var threadLimit = settings.maxThreadCount;

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
function reaggregateLatestPosts(board, parentThreads, callback, index) {

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
      creation : 1,
      postId : 1
    }
  }, {
    $sort : {
      creation : -1
    }
  }, {
    $limit : settings.previewPostCount
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
          latestPosts : foundPosts
        }
      }, function setPosts(error) {
        if (error) {
          callback(error);
        } else {
          reaggregateLatestPosts(board, parentThreads, callback, index + 1);
        }

      });

      // style exception, too simple

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
      reaggregateLatestPosts(board, parentThreads,
          function reaggregated(error) {
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
          removeContentFiles(userData, board, threadsToDelete, postsToDelete,
              parameters, foundBoards, cb, foundThreads, foundPosts,
              parentThreads);
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
      callback('Board not found');
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
    console.log('User identification ' + JSON.stringify(userData));
  }

  console.log('Deleting threads: ' + JSON.stringify(threadsToDelete));
  console.log('Deleting posts: ' + JSON.stringify(postsToDelete));
}

// TODO document this thing before anything else
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

function deleteBoardContent(board, callback) {
  threads.remove({
    boardUri : board.boardUri
  }, function threadsDeleted(error) {
    if (error) {
      callback(error);
    } else {

      // style exception, too simple
      posts.remove({
        boardUri : board.boardUri
      }, function removedPosts(error) {

        process.send({
          frontPage : true
        });

        callback(error);

      });
      // style exception, too simple

    }
  });

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
          deleteBoardContent(board, callback);
        }

      });
      // style exception, too simple

    }
  });

}

function deleteBoard(board, callback) {

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
          deleteBoardFiles(board, callback);
        }
      });

      // style exception, too simple

    }
  });

}

exports.board = function(userData, boardUri, callback) {

  var isUser = userData.globalRole >= miscOps.getMaxStaffRole();

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
      callback('Board not found');
    } else if (board.owner !== userData.login && isUser) {
      callback('You are not allowed to perform this operation');
    } else {
      deleteBoard(board, callback);
    }
  });

};
// end of board deletion
