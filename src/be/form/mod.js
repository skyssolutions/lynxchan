'use strict';

var domManipulator = require('../engine/domManipulator').staticPages;
var db = require('../db');
var boards = db.boards();
var url = require('url');
var threads = db.threads();
var flags = db.flags();
var settingsHandler = require('../settingsHandler');
var lang = require('../engine/langOps').languagePack;
var posts = db.posts();
var miscOps = require('../engine/miscOps');
var jsonBuilder = require('../engine/jsonBuilder');
var modOps = require('../engine/modOps').common;
var formOps = require('../engine/formOps');
var generator = require('../engine/generator');

exports.outputModData = function(bData, flagData, thread, posts, res, json,
    userRole, auth, language) {

  if (json) {

    formOps.outputResponse('ok', jsonBuilder.thread(bData.boardUri, bData,
        thread, posts, null, true, userRole, flagData), res, null, auth, null,
        true);

  } else {

    domManipulator.thread(bData, flagData, thread, posts,
        function gotThreadContent(error, content) {
          if (error) {
            formOps.outputError(error, 500, res, language, json, auth);
          } else {
            formOps.dynamicPage(res, content, auth);
          }
        }, true, userRole, language);
  }

};

exports.outputBoardModData = function(parameters, threadsArray, language, auth,
    bData, userRole, pCount, flagData, latestPosts, res) {

  if (parameters.json) {

    jsonBuilder.page(bData.boardUri, parameters.page, threadsArray, pCount,
        bData, flagData, latestPosts, true, userRole, function(error, content) {
          formOps.outputResponse('ok', content, res, null, auth, null, true);
        });

  } else {

    domManipulator.page(parameters.page, threadsArray, pCount, bData, flagData,
        latestPosts, language, true, userRole, function gotThreadContent(error,
            content) {

          if (error) {
            formOps.outputError(error, 500, res, language, parameters.json,
                auth);
          } else {
            formOps.dynamicPage(res, content, auth);
          }

        });
  }

};

exports.getPostingData = function(boardData, flagData, parameters, res, json,
    userRole, auth, language) {

  threads.findOne({
    threadId : +parameters.threadId,
    boardUri : boardData.boardUri
  }, {
    projection : generator.threadModProjection
  }, function gotThread(error, thread) {
    if (error) {
      formOps.outputError(error, 500, res, language, json, auth);
    } else if (!thread) {
      formOps.outputError(lang(language).errThreadNotFound, 500, res, language,
          json, auth);
    } else {

      // style exception, too simple
      posts.find({
        threadId : +parameters.threadId,
        boardUri : boardData.boardUri
      }, {
        projection : generator.postModProjection
      }).sort({
        creation : 1
      }).toArray(
          function gotPosts(error, posts) {
            if (error) {
              formOps.outputError(error, 500, res, language, json, auth);
            } else {

              exports.outputModData(boardData, flagData, thread, posts, res,
                  json, userRole, auth, language);
            }

          });

      // style exception, too simple
    }

  });

};

exports.getLatestPosts = function(parameters, threadsArray, userRole,
    pageCount, boardData, flagData, auth, res, language) {

  var postsToFetch = [];

  var latestPinned = settingsHandler.getGeneralSettings().latestPostPinned;

  for (var i = 0; i < threadsArray.length; i++) {

    var thread = threadsArray[i];
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
      boardUri : boardData.boardUri,
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
  } ])
      .toArray(
          function gotPosts(error, latestPosts) {
            if (error) {
              formOps.outputError(error, 500, res, language, parameters.json,
                  auth);
            } else {

              exports.outputBoardModData(parameters, threadsArray, language,
                  auth, boardData, userRole, pageCount, flagData, latestPosts,
                  res);

            }
          });

};

exports.getThreads = function(boardData, parameters, flagData, userRole, res,
    language, auth) {

  var pageSize = settingsHandler.getGeneralSettings().pageSize;

  var pageCount = Math.ceil(boardData.threadCount / pageSize);

  pageCount = pageCount || 1;

  var toSkip = (parameters.page - 1) * pageSize;

  threads.find({
    boardUri : boardData.boardUri,
    archived : {
      $ne : true
    }
  }, {
    projection : generator.threadModProjection
  }).sort({
    pinned : -1,
    lastBump : -1
  }).skip(toSkip).limit(pageSize)
      .toArray(
          function gotThreads(error, threadsArray) {

            if (error) {
              formOps.outputError(error, 500, res, language, parameters.json,
                  auth);
            } else {

              exports.getLatestPosts(parameters, threadsArray, userRole,
                  pageCount, boardData, flagData, auth, res, language);
            }
          });

};

exports.getFlags = function(board, parameters, res, json, userRole, auth,
    language) {

  flags.find({
    boardUri : parameters.boardUri
  }, {
    projection : {
      name : 1
    }
  }).sort({
    name : 1
  }).toArray(
      function gotFlags(error, flagData) {
        if (error) {
          formOps.outputError(error, 500, res, language, json, auth);
        } else {

          if (parameters.threadId) {
            exports.getPostingData(board, flagData, parameters, res, json,
                userRole, auth, language);
          } else {

            exports.getThreads(board, parameters, flagData, userRole, res,
                language, auth);

          }
        }
      });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, false,
      function gotData(auth, userData) {

        var parameters = url.parse(req.url, true).query;

        var json = parameters.json;

        if (formOps.checkBlankParameters(parameters, [ 'boardUri' ], res,
            req.language, json)) {
          return;
        }

        parameters.page = parameters.page || 1;
        parameters.page = +parameters.page;

        var globalStaff = userData.globalRole <= miscOps.getMaxStaffRole();

        // style exception, too simple
        boards.findOne({
          boardUri : parameters.boardUri
        }, {
          projection : generator.board.boardModProjection
        }, function gotBoard(error, board) {

          if (error) {
            formOps.outputError(error, 500, res, req.language, json, auth);
          } else if (!board) {
            formOps.outputError(lang(req.language).errBoardNotFound, 500, res,
                req.language, json, auth);
          } else if (!modOps.isInBoardStaff(userData, board) && !globalStaff) {
            formOps.outputError(lang(req.language).errDeniedManageBoard, 500,
                res, req.language, json, auth);
          } else {
            exports.getFlags(board, parameters, res, json, userData.globalRole,
                auth, req.language);
          }
        });
        // style exception, too simple

      }, false, true);

};