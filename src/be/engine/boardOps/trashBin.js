'use strict';

var db = require('../../db');
var threads = db.threads();
var boards = db.boards();
var posts = db.posts();
var modCommonOps;
var latestPinned;
var generator;
var delOps;
var lang;

exports.loadDependencies = function() {
  lang = require('../langOps').languagePack;
  modCommonOps = require('../modOps').common;
  delOps = require('../deletionOps').postingDeletions;
  generator = require('../generator');
};

exports.loadSettings = function() {

  var settings = require('../../settingsHandler').getGeneralSettings();
  latestPinned = settings.latestPostPinned;

};

// Section 1: Fetch {
exports.getTrashPosts = function(threadsArray, latestPosts, parentThreads,
    foundBoard, callback) {

  posts.find({
    boardUri : foundBoard.boardUri,
    trash : true,
    threadId : {
      $nin : parentThreads
    }
  }, {
    projection : generator.postModProjection
  }).toArray(function(error, foundPosts) {

    callback(error, threadsArray, foundPosts, latestPosts, foundBoard);

  });

};

exports.getLatestPosts = function(threadsArray, foundBoard, callback) {

  var postsToFetch = [];
  var parentThreads = [];

  for (var i = 0; i < threadsArray.length; i++) {

    var thread = threadsArray[i];
    parentThreads.push(thread.threadId);

    var threadLatest = thread.latestPosts;

    if (threadLatest) {

      if (thread.pinned && threadLatest.length > latestPinned) {
        threadLatest.splice(0, threadLatest.length - latestPinned);
      }

      postsToFetch = postsToFetch.concat(thread.latestPosts);
    }
  }

  posts.aggregate([ {
    $match : {
      boardUri : foundBoard.boardUri,
      postId : {
        $in : postsToFetch
      }
    }
  }, {
    $project : generator.postModProjection
  }, {
    $group : {
      _id : '$threadId',
      latestPosts : {
        $push : {
          ip : '$ip',
          asn : '$asn',
          boardUri : '$boardUri',
          threadId : '$threadId',
          postId : '$postId',
          banMessage : '$banMessage',
          flag : '$flag',
          markdown : '$markdown',
          alternativeCaches : '$alternativeCaches',
          files : '$files',
          outerCache : '$outerCache',
          bypassId : '$bypassId',
          flagCode : '$flagCode',
          flagName : '$flagName',
          name : '$name',
          lastEditTime : '$lastEditTime',
          lastEditLogin : '$lastEditLogin',
          signedRole : '$signedRole',
          id : '$id',
          email : '$email',
          subject : '$subject',
          creation : '$creation'
        }
      }
    }
  } ]).toArray(
      function gotPosts(error, latestPosts) {

        if (error) {
          callback(error);
        } else {

          exports.getTrashPosts(threadsArray, latestPosts, parentThreads,
              foundBoard, callback);

        }
      });

};

exports.getTrashThreads = function(foundBoard, callback) {

  threads.find({
    boardUri : foundBoard.boardUri,
    trash : true
  }, {
    projection : generator.threadModProjection
  }).sort({
    lastBump : -1
  }).toArray(function gotThreads(error, threadsArray) {

    if (error) {
      callback(error);
    } else {
      exports.getLatestPosts(threadsArray, foundBoard, callback);
    }

  });

};

exports.getTrash = function(user, parameters, language, callback) {

  boards.findOne({
    boardUri : parameters.boardUri
  }, function(error, foundBoard) {

    if (error) {
      return callback(error);
    } else if (!foundBoard) {
      return callback(lang(language).errBoardNotFound);
    } else if (modCommonOps.isInBoardStaff(user, foundBoard)) {
      exports.getTrashThreads(foundBoard, callback);
    } else {
      callback(lang(language).errDeniedManageBoard);
    }

  });

};
// } Section 1: Fetch

// Section 2: Restore {
exports.restorePosts = function(board, foundThreads, foundPosts, parentThreads,
    callback) {

  if (!foundPosts.length && !foundThreads.length) {
    return callback();
  }

  posts.updateMany({
    boardUri : board.boardUri,
    $or : [ {
      postId : {
        $in : foundPosts
      }
    }, {
      threadId : {
        $in : foundThreads
      }
    } ]
  }, {
    $unset : {
      trash : true
    }
  }, function(error) {

    if (error) {
      return callback(error);
    }

    callback(null, foundThreads, parentThreads);

  });

};

exports.findParentThreads = function(board, foundThreads, foundPosts,
    parentThreads, callback) {

  threads.find({
    trash : {
      $ne : true
    },
    boardUri : board.boardUri,
    threadId : {
      $in : parentThreads
    }
  }, {
    projection : {
      threadId : 1
    }
  }).toArray(
      function(error, foundParents) {

        if (error) {
          return callback(error);
        }

        parentThreads = [];
        var postsToRestore = [];

        for (var i = 0; i < foundParents.length; i++) {
          parentThreads.push(foundParents[i].threadId);
        }

        for (i = 0; i < foundPosts.length; i++) {

          var entry = foundPosts[i];

          if (parentThreads.indexOf(entry._id) >= 0) {
            postsToRestore = postsToRestore.concat(entry.posts);
          }

        }

        exports.restorePosts(board, foundThreads, postsToRestore,
            parentThreads, callback);

      });

};

exports.getParentThreads = function(board, foundThreads, postsToRestore,
    callback) {

  if (!postsToRestore[board.boardUri]) {
    return exports.restorePosts(board, foundThreads, [], [], callback);
  }

  posts.aggregate([ {
    $match : {
      trash : true,
      boardUri : board.boardUri,
      postId : {
        $in : postsToRestore[board.boardUri]
      },
      threadId : {
        $nin : foundThreads
      }
    }
  }, {
    $project : {
      _id : 0,
      threadId : 1,
      postId : 1
    }
  }, {
    $group : {
      _id : '$threadId',
      posts : {
        $push : '$postId'
      }
    }
  } ]).toArray(
      function(error, results) {

        if (error) {
          return callback(error);
        }

        var parentThreads = [];

        for (var i = 0; i < results.length; i++) {

          var entry = results[i];

          parentThreads.push(entry._id);

        }

        exports.findParentThreads(board, foundThreads, results, parentThreads,
            callback);

      });

};

exports.restoreThreads = function(board, foundThreads, postsToRestore, cb) {

  if (!foundThreads.length) {
    return exports.getParentThreads(board, foundThreads, postsToRestore, cb);
  }

  threads.updateMany({
    boardUri : board.boardUri,
    threadId : {
      $in : foundThreads
    }
  }, {
    $unset : {
      trash : true
    }
  }, function(error) {

    if (error) {
      cb(error);
    } else {
      exports.getParentThreads(board, foundThreads, postsToRestore, cb);
    }

  });

};

exports.getThreadsToRestore = function(board, threadsToRestore, postsToRestore,
    callback) {

  if (!threadsToRestore[board.boardUri]) {
    return exports.getParentThreads(board, [], postsToRestore, callback);
  }

  threads.aggregate([ {
    $match : {
      trash : true,
      boardUri : board.boardUri,
      threadId : {
        $in : threadsToRestore[board.boardUri]
      }
    }
  }, {
    $group : {
      _id : 0,
      threads : {
        $push : '$threadId'
      }
    }
  } ]).toArray(
      function(error, results) {

        if (error) {
          return callback(error);
        }

        exports.restoreThreads(board, results.length ? results[0].threads : [],
            postsToRestore, callback);
      });

};

exports.iterateBoardsToRestore = function(foundBoards, userData,
    threadsToRestore, postsToRestore, language, callback) {

  if (!foundBoards.length) {
    return callback();
  }

  boards.findOne({
    boardUri : foundBoards.shift()
  }, {
    projection : {
      boardUri : 1,
      owner : 1,
      _id : 0,
      volunteers : 1
    }
  }, function gotBoard(error, board) {

    if (error) {
      return callback(error);
    } else if (!board) {
      return callback(lang(language).errBoardNotFound);
    } else if (!modCommonOps.isInBoardStaff(userData, board)) {
      return callback(lang(language).errDeniedManageBoard);
    }

    exports.getThreadsToRestore(board, threadsToRestore, postsToRestore,
        function(error, foundThreads, parentThreads) {

          if (error) {
            callback(error);
          } else if (foundThreads) {

            delOps.updateBoardAndThreads(board, {}, function(error) {

              if (error) {
                return callback(error);
              }

              // style exception, too simple
              exports.iterateBoardsToRestore(foundBoards, userData,
                  threadsToRestore, postsToRestore, language, callback);
              // style exception, too simple

            }, foundThreads, [], parentThreads.concat(foundThreads));

          } else {

            exports.iterateBoardsToRestore(foundBoards, userData,
                threadsToRestore, postsToRestore, language, callback);
          }

        });

  });

};

exports.restore = function(userData, threadsToRestore, postsToRestore,
    language, callback) {

  var foundBoards = [];

  for ( var key in threadsToRestore) {

    if (threadsToRestore.hasOwnProperty(key)) {
      if (foundBoards.indexOf(key) === -1) {
        foundBoards.push(key);
      }
    }

  }

  for (key in postsToRestore) {

    if (postsToRestore.hasOwnProperty(key)) {
      if (foundBoards.indexOf(key) === -1) {
        foundBoards.push(key);
      }
    }

  }

  exports.iterateBoardsToRestore(foundBoards, userData, threadsToRestore,
      postsToRestore, language, callback);
};
// } Section 2: Restore
