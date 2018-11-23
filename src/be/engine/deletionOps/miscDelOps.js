'use strict';

// handles automatic deletions and board deletion

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
var overboard;
var lang;
var sfwOverboard;
var logOps;
var boardOps;
var referenceHandler;
var overboardOps;
var gridFs;

exports.collectionsToClean = [ reports, posts, threads, flags, hashBans,
    boardStats, bans, globalLatestPosts, globalLatestImages ];

exports.loadSettings = function() {
  var settings = require('../../settingsHandler').getGeneralSettings();

  sfwOverboard = settings.sfwOverboard;
  overboard = settings.overboard;
};

exports.loadDependencies = function() {

  logOps = require('../logOps');
  overboardOps = require('../overboardOps');
  referenceHandler = require('../mediaHandler');
  lang = require('../langOps').languagePack;
  gridFs = require('../gridFsHandler');
  boardOps = require('../boardOps').meta;
};

// Section 1: Thread cleanup {
exports.removeThreads = function(boardUri, threadsToDelete, callback) {

  var queryBlock = {
    boardUri : boardUri,
    threadId : {
      $in : threadsToDelete
    }
  };

  threads.removeMany(queryBlock, function removedThreads(error, result) {

    if (error) {
      callback(error);
    } else {

      for (var i = 0; i < threadsToDelete.length; i++) {
        process.send({
          board : boardUri,
          thread : threadsToDelete[i]
        });
      }

      // style exception, too simple
      reports.removeMany(queryBlock, function removedReports(error) {

        if (error) {
          callback(error);
        } else {
          boardOps.aggregateThreadCount(boardUri, callback);
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

exports.pruneThreadsForAggregation = function(aggregation, boardUri, language,
    callback) {

  threads.aggregate(aggregation).toArray(
      function gotThreads(error, threadsToRemove) {

        if (error) {
          callback(error);
        } else if (!threadsToRemove.length) {
          callback();
        } else {

          var prunedThreads = threadsToRemove[0].threads;

          // style exception, too simple
          referenceHandler.clearPostingReferences(boardUri, prunedThreads,
              null, false, false, null, language, function removedReferences(
                  error) {

                if (error) {
                  callback(error);
                } else {
                  exports.removePostsFromPrunedThreads(boardUri, prunedThreads,
                      callback);
                }
              });
          // style exception, too simple

        }
      });

};

exports.cleanThreads = function(boardUri, early404, limit, language, callback) {

  if (early404) {

    exports.pruneThreadsForAggregation([ {
      $match : {
        boardUri : boardUri,
        archived : {
          $ne : true
        }
      }
    }, {
      $sort : {
        pinned : -1,
        lastBump : -1
      }
    }, {
      $skip : Math.floor(limit / 3)
    }, {
      $match : {
        postCount : {
          $not : {
            $gte : 5
          }
        }
      }
    }, {
      $group : {
        _id : 0,
        threads : {
          $push : '$threadId'
        }
      }
    } ], boardUri, language, function cleaned404(error) {

      if (error) {
        callback(error);
      } else {
        exports.cleanThreads(boardUri, false, limit, language, callback);
      }

    });

    return;
  }

  exports.pruneThreadsForAggregation([ {
    $match : {
      boardUri : boardUri,
      archived : {
        $ne : true
      }
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
  } ], boardUri, language, callback);

};
// } Section 1: Thread cleanup

// Section 2: Board deletion {
exports.deleteBoardContent = function(board, callback, index) {
  index = index || 0;

  if (index < exports.collectionsToClean.length) {

    exports.collectionsToClean[index].deleteMany({
      boardUri : board
    }, function removedData(error) {
      exports.deleteBoardContent(board, callback, ++index);

    });

  } else {

    process.send({
      board : board,
      buildAll : true
    });

    process.send({
      board : board,
      multiboard : true
    });

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
  } ]).toArray(function gotFiles(error, results) {
    if (error) {
      callback(error);
    } else if (!results.length) {
      exports.deleteBoardContent(board.boardUri, callback);
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

  var message = lang().logBoardDeletion.replace('{$board}', board.boardUri)
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

exports.board = function(userData, parameters, language, callback) {

  if (!parameters.confirmDeletion) {
    callback(lang(language).errBoardDelConfirmation);

    return;
  }

  var admin = userData.globalRole < 2;

  boards.findOne({
    boardUri : parameters.boardUri
  }, {
    projection : {
      _id : 0,
      boardUri : 1,
      owner : 1,
      volunteers : 1
    }
  }, function gotBoard(error, board) {
    if (error) {
      callback(error);
    } else if (!board) {
      callback(lang(language).errBoardNotFound);
    } else if (board.owner !== userData.login && !admin) {
      callback(lang(language).errDeniedBoardDeletion);
    } else {

      // style exception, too simple
      referenceHandler.clearBoardReferences(board.boardUri, language,
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
