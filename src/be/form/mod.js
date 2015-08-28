'use strict';

var domManipulator = require('../engine/domManipulator').staticPages;
var db = require('../db');
var boards = db.boards();
var url = require('url');
var threads = db.threads();
var flags = db.flags();
var lang = require('../engine/langOps').languagePack();
var posts = db.posts();
var miscOps = require('../engine/miscOps');
var jsonBuilder = require('../engine/jsonBuilder');
var modOps = require('../engine/modOps').common;
var formOps = require('../engine/formOps');

function outputModData(boardData, flagData, thread, posts, res, json) {

  if (json) {
    res.writeHead(200, miscOps.corsHeader('application/json'));

    res.end(jsonBuilder.thread(boardData.boardUri, boardData, thread, posts,
        null, true));

  } else {

    domManipulator.thread(boardData.boardUri, boardData, flagData, thread,
        posts, function gotThreadContent(error, content) {
          if (error) {
            formOps.outputError(error, res);
          } else {
            res.writeHead(200, miscOps.corsHeader('text/html'));

            res.end(content);
          }
        }, true);
  }

}

function getPostingData(boardData, flagData, parameters, res, json) {

  threads.findOne({
    threadId : +parameters.threadId,
    boardUri : boardData.boardUri
  }, {
    _id : 0,
    subject : 1,
    threadId : 1,
    flag : 1,
    locked : 1,
    cyclic : 1,
    flagName : 1,
    pinned : 1,
    lastEditTime : 1,
    lastEditLogin : 1,
    creation : 1,
    id : 1,
    banMessage : 1,
    ip : 1,
    name : 1,
    signedRole : 1,
    files : 1,
    email : 1,
    message : 1,
    markdown : 1
  }, function gotThread(error, thread) {
    if (error) {
      formOps.outputError(thread);
    } else if (!thread) {
      formOps.outputError(lang.errThreadNotFound, 500, res);
    } else {

      // style exception, too simple
      posts.find({
        threadId : +parameters.threadId,
        boardUri : boardData.boardUri
      }, {
        _id : 0,
        signedRole : 1,
        subject : 1,
        ip : 1,
        creation : 1,
        flagName : 1,
        flag : 1,
        threadId : 1,
        lastEditTime : 1,
        lastEditLogin : 1,
        id : 1,
        postId : 1,
        message : 1,
        name : 1,
        files : 1,
        email : 1,
        banMessage : 1,
        markdown : 1
      }).sort({
        creation : 1
      }).toArray(function gotPosts(error, posts) {
        if (error) {
          formOps.outputError(error, 500, res);
        } else {
          outputModData(boardData, flagData, thread, posts, res, json);
        }

      });

      // style exception, too simple
    }

  });

}

function getFlags(board, parameters, res, json) {

  if (json) {
    getPostingData(board, null, parameters, res, true);
  } else {

    flags.find({
      boardUri : parameters.boardUri
    }, {
      name : 1
    }).sort({
      name : 1
    }).toArray(function gotFlags(error, flagData) {
      if (error) {
        formOps.outputError(error, 500, res);
      } else {
        getPostingData(board, flagData, parameters, res);
      }
    });
  }

}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, false,
      function gotData(auth, userData) {

        var parameters = url.parse(req.url, true).query;

        if (formOps.checkBlankParameters(parameters,
            [ 'boardUri', 'threadId' ], res)) {
          return;
        }

        var globalStaff = userData.globalRole <= miscOps.getMaxStaffRole();

        // style exception, too simple
        boards.findOne({
          boardUri : parameters.boardUri
        }, {
          owner : 1,
          _id : 0,
          boardUri : 1,
          ipSalt : 1,
          boardName : 1,
          settings : 1,
          boardMarkdown : 1,
          usesCustomCss : 1,
          boardDescription : 1,
          volunteers : 1
        }, function gotBoard(error, board) {
          if (error) {
            formOps.outputError(error, 500, res);
          } else if (!board) {
            formOps.outputError(lang.errBoardNotFound, 500, res);
          } else if (!modOps.isInBoardStaff(userData, board) && !globalStaff) {
            formOps.outputError(lang.errDeniedManageBoard, 500, res);
          } else {
            getFlags(board, parameters, res, parameters.json);
          }
        });
        // style exception, too simple

      });

};