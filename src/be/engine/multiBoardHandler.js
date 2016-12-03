//Handles operations pertinent to multi-boards.

'use strict';

var url = require('url');
var db = require('../db');
var jsonBuilder = require('./jsonBuilder');
var gfsHandler = require('./gridFsHandler');
var debug = require('../kernel').debug();
var threadCount;
var verbose;
var threads = db.threads();
var posts = db.posts();
var boards = db.boards();
var files = db.files();
var domManipulator;
var generator;
var miscOps;
var multiboardThreadCount;
var altLanguages;

exports.loadSettings = function() {

  var settings = require('../settingsHandler').getGeneralSettings();

  threadCount = settings.multiboardThreadCount;
  verbose = settings.verbose || settings.verboseMisc;
  altLanguages = settings.useAlternativeLanguages;
  multiboardThreadCount = settings.multiboardThreadCount;
};

exports.loadDependencies = function() {

  miscOps = require('./miscOps');
  domManipulator = require('./domManipulator').staticPages;
  generator = require('./generator');

};

// Section 1: multi-board page request {
exports.saveCache = function(boardList, content, json, callback, language) {

  var cacheName = boardList.join('_');

  if (json) {
    cacheName += '.json';
  }

  var meta = {
    type : 'multiboard',
    boards : boardList
  };

  if (language) {
    meta.languages = language.headerValues;
    meta.referenceFile = cacheName;
    cacheName += language.headerValues.join('-');
  }

  gfsHandler.writeData(content, cacheName, json ? 'application/json'
      : 'text/html', meta, callback);

};

exports.getNextLanguage = function(boardList, previewRelation, foundThreads,
    callback, language) {

  generator.nextLanguage(language, function gotLanguage(error, language) {

    if (error) {
      callback(error);
    } else if (!language) {
      callback();
    } else {
      exports.generateHTMLPage(boardList, previewRelation, foundThreads,
          callback, language);
    }

  });

};

exports.generateHTMLPage = function(boardList, previewRelation, foundThreads,
    callback, language) {

  domManipulator.overboard(foundThreads, previewRelation, function gotContent(
      error, content) {

    if (error) {
      callback(error);
    } else {

      // style exception
      exports.saveCache(boardList, content, false, function savedCache(error) {
        if (error) {
          callback(error);
        } else {

          if (!altLanguages) {
            callback();
            return;
          }

          exports.getNextLanguage(boardList, previewRelation, foundThreads,
              callback, language);

        }

      }, language);
      // style exception

    }

  }, true, null, language);

};

exports.generatePage = function(boardList, foundPosts, foundThreads, req,
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

  var json = url.parse(req.url).pathname.indexOf('/1.json') >= 0;

  if (!json) {

    exports
        .generateHTMLPage(boardList, previewRelation, foundThreads, callback);

  } else {

    jsonBuilder.overboard(foundThreads, previewRelation, function gotContent(
        error, content) {

      if (error) {
        callback(error);
      } else {
        exports.saveCache(boardList, content, true, callback);
      }

    }, true);

  }

};

exports.getPosts = function(boardList, foundThreads, req, callback) {

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
    exports.generatePage(boardList, [], foundThreads, req, callback);
    return;
  }

  posts.find({
    $or : orArray
  }, generator.postProjection).sort({
    creation : 1
  }).toArray(function gotPosts(error, foundPosts) {
    if (error) {
      callback(error);
    } else {
      exports.generatePage(boardList, foundPosts, foundThreads, req, callback);
    }

  });

};

exports.getThreads = function(boardList, req, callback) {

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
      exports.getPosts(boardList, foundThreads, req, callback);
    }
  });

};

exports.checkCache = function(boardList, req, res, callback) {

  var cacheName = boardList.join('_');

  var path = url.parse(req.url).pathname;

  if (path.indexOf('/1.json') >= 0) {
    cacheName += '.json';
  }

  files.findOne({
    filename : cacheName
  }, function gotCache(error, result) {
    if (error) {
      callback(error);
    } else if (result) {
      gfsHandler.outputFile(cacheName, req, res, callback);
    } else {

      // style exception, too simple
      exports.getThreads(boardList, req, function generatedCache(error) {

        if (error) {
          callback(error);
        } else {
          gfsHandler.outputFile(cacheName, req, res, callback);
        }

      });
      // style exception, too simple

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

  if (!multiboardThreadCount) {
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

      if (debug) {
        throw error;
      } else if (verbose) {
        console.log(error);
      }

    } else if (results.length) {
      gfsHandler.removeFiles(results[0].files);
    }

  });

};