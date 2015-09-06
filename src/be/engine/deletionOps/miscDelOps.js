'use strict';

var logger = require('../../logger');
var db = require('../../db');
var threads = db.threads();
var files = db.files();
var flags = db.flags();
var users = db.users();
var boardStats = db.stats();
var bans = db.bans();
var hashBans = db.hashBans();
var reports = db.reports();
var logs = db.logs();
var posts = db.posts();
var boards = db.boards();
var settings = require('../../boot').getGeneralSettings();
var verbose = settings.verbose;
var threadLimit = settings.maxThreadCount;
var lang;
var gridFs;

var collectionsToClean = [ reports, posts, threads, flags, hashBans,
    boardStats, bans ];

exports.loadDependencies = function() {

  lang = require('../langOps').languagePack();
  gridFs = require('../gridFsHandler');

};

// Section 1: Thread cleanup {
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
// } Section 1: Thread cleanup

// Section 2: Board deletion {
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
// } Section 2: Board deletion

// Section 3: Early 404 removal {
function removeEarly404Files(results, callback) {

  var orArray = [];

  var operations = [];

  var genQueue = require('../../generationQueue');

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
// } Section 3: Early 404 removal
