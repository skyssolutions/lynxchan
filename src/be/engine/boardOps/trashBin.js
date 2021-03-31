'use strict';

var db = require('../../db');
var threads = db.threads();
var boards = db.boards();
var posts = db.posts();
var modCommonOps;
var latestPinned;
var generator;
var lang;

exports.loadDependencies = function() {
  lang = require('../langOps').languagePack;
  modCommonOps = require('../modOps').common;
  generator = require('../generator');
};

exports.loadSettings = function() {

  var settings = require('../../settingsHandler').getGeneralSettings();
  latestPinned = settings.latestPostPinned;

};

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