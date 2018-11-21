'use strict';

// handles operations related to spoiling existing files

var spoilerPath = require('../../kernel').spoilerImage();
var db = require('../../db');
var boards = db.boards();
var threads = db.threads();
var posts = db.posts();
var common;
var lang;
var gfsHandler;

exports.loadDependencies = function() {

  gfsHandler = require('../gridFsHandler');
  lang = require('../langOps').languagePack;
  common = require('.').common;

};

exports.getAdaptedFileArray = function(board, files, filesToDelete) {

  var customSpoilerPath = '/' + board.boardUri + '/custom.spoiler';

  for (var i = 0; i < files.length; i++) {

    var file = files[i];

    var hasThumb = file.thumb !== file.path;

    if (hasThumb && file.thumb.indexOf('/' + board.boardUri + '/media/') > -1) {
      filesToDelete.push(file.thumb);
    }

    file.thumb = board.usesCustomSpoiler ? customSpoilerPath : spoilerPath;

  }

  return files;

};

exports.getOperations = function(threadOps, postOps, filesToDelete,
    foundThreads, foundPosts, board) {

  for (var i = 0; i < foundThreads.length; i++) {

    var thread = foundThreads[i];

    threadOps.push({
      updateOne : {
        filter : {
          _id : thread._id
        },
        update : {
          $set : {
            files : exports.getAdaptedFileArray(board, thread.files,
                filesToDelete)
          },
          $unset : {
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

  for (i = 0; i < foundPosts.length; i++) {

    var post = foundPosts[i];

    postOps.push({
      updateOne : {
        filter : {
          _id : post._id
        },
        update : {
          $set : {
            files : exports.getAdaptedFileArray(board, post.files,
                filesToDelete)
          },
          $unset : {
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

exports.getReloadsArray = function(foundThreads, parentThreads, reloadedPages,
    reloadedThreads) {

  for (var i = 0; i < foundThreads.length; i++) {
    var thread = foundThreads[i];

    reloadedPages.push(thread.page);
    reloadedThreads.push(thread.threadId);

  }

  for (i = 0; i < parentThreads.length; i++) {

    var parent = parentThreads[i];

    if (reloadedPages.indexOf(parent.page) === -1) {
      reloadedPages.push(parent.page);

    }

    if (reloadedThreads.indexOf(parent.threadId) === -1) {
      reloadedThreads.push(parent.threadId);

    }

  }

};

exports.queueReloads = function(parents, foundThreads, foundPosts, board) {

  var reloadedPages = [];
  var reloadedThreads = [];

  exports
      .getReloadsArray(foundThreads, parents, reloadedPages, reloadedThreads);

  for (var i = 0; i < reloadedPages.length; i++) {

    process.send({
      board : board.boardUri,
      page : reloadedPages[i]
    });

  }

  for (i = 0; i < reloadedThreads.length; i++) {

    process.send({
      board : board.boardUri,
      thread : reloadedThreads[i]
    });

  }

};

exports.queueAndClean = function(board, parentThreads, foundThreads,
    foundPosts, filesToDelete, callback) {

  exports.queueReloads(parentThreads, foundThreads, foundPosts, board);

  if (!filesToDelete.length) {
    callback();

    return;
  }

  gfsHandler.removeFiles(filesToDelete, callback);
};

exports.spoilPosts = function(board, postOps, filesToDelete, foundThreads,
    foundPosts, parentThreads, callback) {

  if (!postOps.length) {
    exports.queueAndClean(board, parentThreads, foundThreads, foundPosts,
        filesToDelete, callback);

    return;
  }

  posts.bulkWrite(postOps, function updatedPosts(error) {

    if (error) {
      callback(error);
    } else {

      exports.queueAndClean(board, parentThreads, foundThreads, foundPosts,
          filesToDelete, callback);

    }
  });

};

exports.spoilBoardFiles = function(foundThreads, foundPosts, board,
    parentThreads, callback) {

  var threadOps = [];
  var postOps = [];
  var filesToDelete = [];

  exports.getOperations(threadOps, postOps, filesToDelete, foundThreads,
      foundPosts, board);

  if (!threadOps.length) {
    exports.spoilPosts(board, postOps, filesToDelete, foundThreads, foundPosts,
        parentThreads, callback);
    return;
  }

  threads.bulkWrite(threadOps, function updatedThreads(error) {

    if (error) {
      callback(error);
    } else {

      exports.spoilPosts(board, postOps, filesToDelete, foundThreads,
          foundPosts, parentThreads, callback);

    }

  });

};

exports.getParentThreads = function(foundThreads, foundPosts, board, callback) {

  var parentsToFind = [];
  var threadsToExclude = [];

  for (var i = 0; i < foundThreads.length; i++) {
    var thread = foundThreads[i];

    threadsToExclude.push(thread.threadId);
  }

  for (i = 0; i < foundPosts.length; i++) {

    var post = foundPosts[i];

    if (threadsToExclude.indexOf(post.threadId) === -1) {
      parentsToFind.push(post.threadId);
      threadsToExclude.push(post.threadId);
    }
  }

  threads.find({
    boardUri : board.boardUri,
    threadId : {
      $in : parentsToFind
    }
  }, {
    projection : {
      threadId : 1,
      _id : 0,
      page : 1
    }
  }).toArray(
      function gotParents(error, parentThreads) {
        if (error) {
          callback(error);
        } else {
          exports.spoilBoardFiles(foundThreads, foundPosts, board,
              parentThreads, callback);
        }
      });

};

exports.getBoardFiles = function(board, element, callback) {

  threads.find({
    boardUri : board.boardUri,
    page : 1,
    threadId : {
      $in : element.threads
    },
    'files.0' : {
      $exists : true
    }
  }, {
    projection : {
      files : 1,
      threadId : 1,
      page : 1
    }
  }).toArray(function gotThreads(error, foundThreads) {
    if (error) {
      callback(error);
    } else {

      // style exception, too simple
      posts.find({
        boardUri : board.boardUri,
        postId : {
          $in : element.posts
        },
        'files.0' : {
          $exists : true
        }
      }, {
        projection : {
          files : 1,
          postId : 1,
          threadId : 1,
        }
      }).toArray(function gotPosts(error, foundPosts) {

        if (error) {
          callback(error);
        } else {
          exports.getParentThreads(foundThreads, foundPosts, board, callback);
        }
      });
      // style exception, too simple

    }
  });

};

exports.iterateBoards = function(foundBoards, elementRelation, userData,
    language, callback) {

  if (!foundBoards.length) {
    callback();

    return;
  }

  boards.findOne({
    boardUri : foundBoards.shift()
  }, {
    projection : {
      _id : 0,
      boardUri : 1,
      usesCustomSpoiler : 1,
      owner : 1,
      volunteers : 1
    }
  }, function gotBoard(error, board) {
    if (error) {
      callback(error);
    } else if (!board) {
      exports.iterateBoards(foundBoards, elementRelation, userData, language,
          callback);
    } else if (!common.isInBoardStaff(userData, board)) {
      callback(lang(language).errDeniedSpoilered);
    } else {

      // style exception, too simple
      exports.getBoardFiles(board, elementRelation[board.boardUri],
          function spoileredFiles(error) {
            if (error) {
              callback(error);
            } else {
              exports.iterateBoards(foundBoards, elementRelation, userData,
                  language, callback);
            }
          });
      // style exception, too simple

    }

  });

};

exports.spoiler = function(userData, reportedElements, language, callback) {

  var elementRelation = {};
  var foundBoards = [];

  for (var i = 0; i < reportedElements.length && i < 1000; i++) {
    var element = reportedElements[i];
    var board = element.board;

    var boardObject = elementRelation[board] || {
      posts : [],
      threads : []
    };

    if (foundBoards.indexOf(board) === -1) {
      foundBoards.push(board.toString());
    }

    if (element.post) {
      boardObject.posts.push(+element.post);
    } else {
      boardObject.threads.push(+element.thread);
    }

    elementRelation[board] = boardObject;

  }

  exports.iterateBoards(foundBoards, elementRelation, userData, language,
      callback);

};