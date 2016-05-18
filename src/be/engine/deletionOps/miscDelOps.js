'use strict';

// handles automatic deletions and board deletion

var logger = require('../../logger');
var db = require('../../db');
var threads = db.threads();
var files = db.files();
var flags = db.flags();
var users = db.users();
var globalLatestPosts = db.latestPosts();
var globalLatestImages = db.latestImages();
var boardStats = db.stats();
var bans = db.bans();
var hashBans = db.hashBans();
var reports = db.reports();
var posts = db.posts();
var boards = db.boards();
var verbose;
var overboard;
var lang;
var sfwOverboard;
var logOps;
var referenceHandler;
var overboardOps;
var gridFs;

var collectionsToClean = [ reports, posts, threads, flags, hashBans,
    boardStats, bans, globalLatestPosts, globalLatestImages ];

exports.loadSettings = function() {
  var settings = require('../../settingsHandler').getGeneralSettings();

  sfwOverboard = settings.sfwOverboard;
  verbose = settings.verbose;
  overboard = settings.overboard;
};

exports.loadDependencies = function() {

  logOps = require('../logOps');
  overboardOps = require('../overboardOps');
  referenceHandler = require('../mediaHandler');
  lang = require('../langOps').languagePack();
  gridFs = require('../gridFsHandler');

};

// Section 1: Thread cleanup {
exports.removeThreads = function(boardUri, threadsToDelete, callback) {

  threads.deleteMany({
    boardUri : boardUri,
    threadId : {
      $in : threadsToDelete
    }
  }, function removedThreads(error, result) {

    if (error) {
      callback(error);
    } else {

      // style exception, too simple
      threads.count({
        boardUri : boardUri
      }, function counted(error, count) {

        if (error) {
          callback(error);
        } else {

          boards.updateOne({
            boardUri : boardUri
          }, {
            $set : {
              threadCount : count
            }
          }, callback);

        }

      });
      // style exception, too simple

    }

  });

};

exports.removePostsFromPrunedThreads = function(boardUri, threadsToDelete,
    callback) {

  posts.deleteMany({
    boardUri : boardUri,
    threadId : {
      $in : threadsToDelete
    }
  }, function deletedPosts(error) {

    if (error) {
      callback(error);
    } else {
      exports.removeThreads(boardUri, threadsToDelete, callback);
    }

  });

};

exports.getThreadFilesToRemove = function(boardUri, threadsToRemove, callback) {

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
          exports.removePostsFromPrunedThreads(boardUri, threadsToRemove,
              callback);
        }
      });
      // style exception, too simple

    }
  });

};

exports.cleanThreads = function(boardUri, limit, callback) {

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
    $skip : limit
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

      var prunedThreads = threadsToRemove[0].threads;

      // style exception, too simple
      referenceHandler
          .clearPostingReferences(boardUri, prunedThreads, null, false, false,
              function removedReferences(error) {

                if (error) {
                  callback(error);
                } else {
                  exports.getThreadFilesToRemove(boardUri, prunedThreads,
                      callback);
                }
              });
      // style exception, too simple

    }
  });

};
// } Section 1: Thread cleanup

// Section 2: Board deletion {
exports.deleteBoardContent = function(board, callback, index) {
  index = index || 0;

  if (index < collectionsToClean.length) {

    collectionsToClean[index].deleteMany({
      boardUri : board
    }, function removedData(error) {
      exports.deleteBoardContent(board, callback, index + 1);

    });

  } else {
    process.send({
      frontPage : true
    });

    if (overboard || sfwOverboard) {
      overboardOps.reaggregate({
        overboard : true,
        reaggregate : true
      });
    }

    callback();
  }

};

exports.deleteBoardFiles = function(board, callback) {

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
          exports.deleteBoardContent(board.boardUri, callback);
        }

      });
      // style exception, too simple

    }
  });

};

exports.logBoardDeletion = function(board, user, callback) {

  var message = lang.logBoardDeletion.replace('{$board}', board.boardUri)
      .replace('{$login}', user);

  logOps.insertLog({
    type : 'boardDeletion',
    user : user,
    time : new Date(),
    boardUri : board.boardUri,
    description : message,
    global : true
  }, function insertedLog() {

    exports.deleteBoardFiles(board, callback);

  });
};

exports.updateVolunteeredList = function(board, user, callback) {

  if (!board.volunteers || !board.volunteers.length) {
    exports.logBoardDeletion(board, user, callback);
    return;
  }

  users.updateMany({
    login : {
      $in : board.volunteers
    }
  }, {
    $pull : {
      volunteeredBoards : board.boardUri
    }
  }, function updatedVolunteers(error) {

    if (error) {
      callback(error);
    } else {
      exports.logBoardDeletion(board, user, callback);

    }

  });

};

exports.deleteBoard = function(board, user, callback) {

  boards.deleteOne({
    boardUri : board.boardUri
  }, function removedBoard(error) {
    if (error) {
      callback(error);
    } else {

      // style exception, too simple
      users.updateOne({
        login : board.owner
      }, {
        $pull : {
          ownedBoards : board.boardUri
        }
      }, function updatedUserBoards(error) {
        if (error) {
          callback(error);
        } else {
          exports.updateVolunteeredList(board, user, callback);
        }
      });
      // style exception, too simple

    }
  });

};

exports.board = function(userData, parameters, callback) {

  if (!parameters.confirmDeletion) {
    callback(lang.errBoardDelConfirmation);

    return;
  }

  var admin = userData.globalRole < 2;

  boards.findOne({
    boardUri : parameters.boardUri
  }, {
    _id : 0,
    boardUri : 1,
    owner : 1,
    volunteers : 1
  }, function gotBoard(error, board) {
    if (error) {
      callback(error);
    } else if (!board) {
      callback(lang.errBoardNotFound);
    } else if (board.owner !== userData.login && !admin) {
      callback(lang.errDeniedBoardDeletion);
    } else {

      // style exception, too simple
      referenceHandler.clearBoardReferences(board.boardUri,
          function clearedReferences(error) {
            if (error) {
              callback(error);
            } else {
              exports.deleteBoard(board, userData.login, callback);

            }

          });
      // style exception, too simple

    }
  });

};
// } Section 2: Board deletion

// Section 3: Early 404 removal {
exports.removeEarly404Files = function(results, callback) {

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
};

exports.removeEarly404Posts = function(results, callback) {

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
          exports.removeEarly404Files(results, callback);
        }
      });
      // style exception, too simple

    }
  });

};

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
          exports.removeEarly404Posts(results, callback);
        }
      });
      // style exception, too simple

    }
  });

};
// } Section 3: Early 404 removal
