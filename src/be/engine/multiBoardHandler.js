'use strict';

var db = require('../db');
var gfsHandler = require('./gridFsHandler');
var settings = require('../settingsHandler').getGeneralSettings();
var threadCount = settings.multiboardThreadCount;
var debug = require('../boot').debug();
var verbose = settings.verbose;
var threads = db.threads();
var posts = db.posts();
var boards = db.boards();
var files = db.files();
var domManipulator;
var miscOps;
var generator;

exports.loadDependencies = function() {

  miscOps = require('./miscOps');
  domManipulator = require('./domManipulator').staticPages;
  generator = require('./generator');

};

// Section 1: multi-board page request {
exports.saveCache = function(boardList, html, req, res, callback) {

  var cacheName = boardList.join('_');

  gfsHandler.writeData(html, cacheName, 'text/html', {
    type : 'multiboard',
    boards : boardList
  }, function savedCache(error) {
    if (error) {
      callback(error);
    } else {
      gfsHandler.outputFile(cacheName, req, res, callback);
    }
  });

};

exports.generatePage = function(boardList, foundPosts, foundThreads, req, res,
    callback) {

  var previewRelation = {};

  for (var i = 0; i < foundPosts.length; i++) {

    var post = foundPosts[i];

    var boardElement = previewRelation[post.boardUri] || {};

    previewRelation[post.boardUri] = boardElement;

    var threadArray = boardElement[post.threadId] || [];

    threadArray.push(post);

    boardElement[post.threadId] = threadArray;

  }

  domManipulator.overboard(foundThreads, previewRelation, function gotHtml(
      error, html) {
    if (error) {
      callback(error);
    } else {
      exports.saveCache(boardList, html, req, res, callback);
    }
  }, true);

};

exports.getPosts = function(boardList, foundThreads, req, res, callback) {

  var previewRelation = {};

  for (var i = 0; i < foundThreads.length; i++) {

    var thread = foundThreads[i];

    var boardUri = thread.boardUri;

    var previewArray = previewRelation[boardUri] || [];

    previewArray = previewArray.concat(thread.latestPosts);

    previewRelation[boardUri] = previewArray;
  }

  var orArray = [];

  for ( var key in previewRelation) {

    orArray.push({
      boardUri : key,
      postId : {
        $in : previewRelation[key]
      }
    });
  }

  if (!orArray.length) {

    exports.generatePage(boardList, [], foundThreads, req, res, callback);
    return;
  }

  posts.find({
    $or : orArray
  }, generator.postProjection).sort({
    creation : 1
  }).toArray(
      function gotPosts(error, foundPosts) {
        if (error) {
          callback(error);
        } else {
          exports.generatePage(boardList, foundPosts, foundThreads, req, res,
              callback);
        }

      });

};

exports.getThreads = function(boardList, req, res, callback) {

  threads.find({
    boardUri : {
      $in : boardList
    }
  }, generator.threadProjection).sort({
    lastBump : -1
  }).limit(threadCount).toArray(function gotThreads(error, foundThreads) {

    if (error) {
      callback(error);
    } else {
      exports.getPosts(boardList, foundThreads, req, res, callback);
    }
  });

};

exports.checkCache = function(boardList, req, res, callback) {

  var cacheName = boardList.join('_');

  files.findOne({
    filename : cacheName
  }, function gotCache(error, result) {
    if (error) {
      callback(error);
    } else if (result) {
      gfsHandler.outputFile(cacheName, req, res, callback);
    } else {
      exports.getThreads(boardList, req, res, callback);
    }
  });

};

exports.outputBoards = function(boardList, req, res, callback) {

  boards.aggregate([ {
    $match : {
      boardUri : {
        $in : boardList
      }
    }
  }, {
    $project : {
      boardUri : 1,
      _id : 0
    }
  }, {
    $group : {
      _id : 0,
      boards : {
        $push : '$boardUri'
      }
    }
  } ], function gotExistingBoards(error, results) {

    if (error) {
      callback(error);
    } else {
      exports.checkCache(results.length ? results[0].boards.sort() : [], req,
          res, callback);
    }

  });

};
// } Section 1: multi-board page request

exports.clearCache = function(board) {

  if (!settings.multiboardThreadCount) {
    return;
  }

  files.aggregate([ {
    $match : {
      'metadata.type' : 'multiboard',
      'metadata.boards' : board
    }
  }, {
    $project : {
      filename : 1,
      _id : 0
    }
  }, {
    $group : {
      _id : 0,
      files : {
        $push : '$filename'
      }
    }
  } ], function gotPages(error, results) {

    if (error) {

      if (verbose) {
        console.log(error);
      }

      if (debug) {
        throw error;
      }

    } else if (results.length) {
      gfsHandler.removeFiles(results[0].files);
    }

  });

};