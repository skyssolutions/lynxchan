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
var autoArchive;
var redactedModNames;
var mediaHandler;
var sfwOverboard;
var logOps;
var boardOps;
var referenceHandler;
var overboardOps;
var miscOps;
var archiveOps;
var gridFs;

exports.collectionsToClean = [ reports, posts, threads, flags, hashBans,
    boardStats, bans, globalLatestPosts, globalLatestImages ];

exports.loadSettings = function() {
  var settings = require('../../settingsHandler').getGeneralSettings();
  redactedModNames = settings.redactModNames;
  autoArchive = settings.archiveThreshold;
  sfwOverboard = settings.sfwOverboard;
  overboard = settings.overboard;
};

exports.loadDependencies = function() {

  archiveOps = require('../archiveOps');
  mediaHandler = require('../mediaHandler');
  logOps = require('../logOps');
  overboardOps = require('../overboardOps');
  referenceHandler = require('../mediaHandler');
  lang = require('../langOps').languagePack;
  gridFs = require('../gridFsHandler');
  boardOps = require('../boardOps').meta;
  miscOps = require('../miscOps');
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
      function gotThreads(error, prunedThreads) {

        if (error) {
          callback(error);
        } else if (!prunedThreads.length) {
          callback();
        } else {

          var prunedIds = [];
          var archivedIds = [];

          for (var i = 0; i < prunedThreads.length; i++) {

            var thread = prunedThreads[i];

            if (thread.postCount >= autoArchive) {
              archivedIds.push(thread.threadId);
            } else {
              prunedIds.push(thread.threadId);
            }
          }

          archiveOps.autoArchive(archivedIds, boardUri);

          // style exception, too simple
          referenceHandler.clearPostingReferences(boardUri, prunedIds, null,
              false, false, null, language, function removedReferences(error) {

                if (error) {
                  callback(error);
                } else {
                  exports.removePostsFromPrunedThreads(boardUri, prunedIds,
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
      .replace('{$login}', redactedModNames ? lang().guiRedactedName : user);

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
    return callback(lang(language).errBoardDelConfirmation);
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

// Section 3: Single file delection {
exports.removeFile = function(userData, parameters, language, posting, cb) {

  var removed = posting.files.splice(parameters.index, 1)[0];

  (parameters.postId ? posts : threads).updateOne({
    _id : posting._id
  }, {
    $set : {
      files : posting.files
    },
    $unset : miscOps.individualCaches
  }, function(error) {

    var deleteMedia;

    try {
      deleteMedia = JSON.parse(parameters['delete']);
    } catch (error) {
      deleteMedia = false;
    }

    if (error) {
      return cb(error);
    }

    process.send({
      board : posting.boardUri,
      thread : posting.threadId
    });

    process.send({
      board : posting.boardUri,
      page : posting.page
    });

    process.send({
      multiboard : true,
      board : posting.boardUri
    });

    var global = userData.globalRole <= miscOps.getMaxStaffRole();

    if (!deleteMedia || !global) {
      mediaHandler.checkNewOrphans([ removed.sha256 ], cb);
    } else {

      mediaHandler.deleteFiles(null, [ removed.sha256 ], userData, language,
          cb, true);
    }

  });
};

exports.checkSingleRemoval = function(parameters, posting, userData, language,
    callback) {

  parameters.index = +parameters.index || 0;

  if (parameters.index < 0) {
    parameters.index = 0;
  }

  if (!posting.files || posting.files.length <= parameters.index) {
    callback();
  } else {
    exports.removeFile(userData, parameters, language, posting, callback);
  }

};

exports.getThread = function(userData, parameters, language, posting, cb) {

  threads.findOne({
    threadId : posting.threadId,
    boardUri : posting.boardUri
  }, function(error, thread) {

    if (error) {
      cb(error);
    } else if (!thread) {
      cb(lang(language).errPostingNotFound);
    } else {

      posting.page = thread.page;

      exports.checkSingleRemoval(parameters, posting, userData, language, cb);
    }

  });

};

exports.getPosting = function(userData, parameters, language, callback) {

  if (!parameters.postId && !parameters.threadId) {
    return callback(lang(language).errPostingNotFound);
  }

  var query = {
    boardUri : parameters.boardUri
  };

  var key = parameters.postId ? 'postId' : 'threadId';

  query[key] = +parameters.postId || +parameters.threadId;

  (parameters.postId ? posts : threads).findOne(query,
      function(error, posting) {

        if (error) {
          return callback(error);
        } else if (!posting) {
          return callback(lang(language).errPostingNotFound);
        }

        if (!parameters.threadId) {
          exports.getThread(userData, parameters, language, posting, callback);
        } else {
          exports.checkSingleRemoval(parameters, posting, userData, language,
              callback);
        }

      });

};

exports.singleFile = function(userData, parameters, language, callback) {

  boards.findOne({
    boardUri : parameters.boardUri
  }, function(error, board) {

    if (error) {
      return callback(error);
    } else if (!board || !parameters.boardUri) {
      return callback(lang(language).errBoardNotFound);
    }

    if (userData.globalRole <= miscOps.getMaxStaffRole()) {
      return exports.getPosting(userData, parameters, language, callback);
    }

    var volunteers = board.volunteers || [];

    var isVolunteer = volunteers.indexOf(userData.login) >= 0;

    if (userData.login !== board.owner && !isVolunteer) {
      callback(lang(language).errDeniedSingleDeletion);
    } else {
      exports.getPosting(userData, parameters, language, callback);
    }

  });

};
// } Section 3: Single file delection
