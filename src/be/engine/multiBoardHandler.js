'use strict';

var db = require('../db');
var formOps = require('./formOps');
var settings = require('../settingsHandler').getGeneralSettings();
var threadCount = settings.multiboardThreadCount;
var threads = db.threads();
var posts = db.posts();
var domManipulator;
var miscOps;
var generator;

exports.loadDependencies = function() {

  miscOps = require('./miscOps');
  domManipulator = require('./domManipulator').staticPages;
  generator = require('./generator');

};

exports.generatePage = function(foundPosts, foundThreads, res) {

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
      formOps.outputError(error, 500, res);
    } else {

      res.writeHead(200, miscOps.corsHeader('text/html'));

      res.end(html);

    }
  }, true);

};

exports.getPosts = function(foundThreads, res) {

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

    exports.generatePage([], foundThreads, res);
    return;
  }

  posts.find({
    $or : orArray
  }, generator.postProjection).sort({
    creation : 1
  }).toArray(function gotPosts(error, foundPosts) {
    if (error) {
      formOps.outputError(error, 500, res);
    } else {
      exports.generatePage(foundPosts, foundThreads, res);
    }

  });

};

exports.outputBoards = function(boards, res) {

  threads.find({
    boardUri : {
      $in : boards
    }
  }, generator.threadProjection).sort({
    lastBump : -1
  }).limit(threadCount).toArray(function gotThreads(error, foundThreads) {

    if (error) {
      formOps.outputError(error, 500, res);
    } else {

      exports.getPosts(foundThreads, res);

    }

  });

};