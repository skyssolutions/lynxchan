'use strict';

var domManipulator = require('../engine/domManipulator');
var db = require('../db');
var boards = db.boards();
var url = require('url');
var threads = db.threads();
var posts = db.posts();
var miscOps = require('../engine/miscOps');
var modOps = require('../engine/modOps');
var formOps = require('../engine/formOps');

function outputModData(boardData, thread, posts, res) {

  domManipulator.thread(boardData.boardUri, boardData, thread, posts,
      function gotThreadContent(error, content) {
        if (error) {
          formOps.outputError(error, res);
        } else {
          res.writeHead(200, miscOps.corsHeader('text/html'));

          res.end(content);
        }
      }, true);

}

function getPostingData(boardData, parameters, res) {

  threads.findOne({
    threadId : +parameters.threadId,
    boardUri : boardData.boardUri
  }, {
    _id : 0,
    subject : 1,
    threadId : 1,
    locked : 1,
    pinned : 1,
    creation : 1,
    id : 1,
    banMessage : 1,
    name : 1,
    files : 1,
    email : 1,
    message : 1
  }, function gotThread(error, thread) {
    if (error) {
      formOps.outputError(thread);
    } else if (!thread) {
      formOps.outputError('Thread not found', 500, res);
    } else {

      // style exception, too simple
      posts.find({
        threadId : +parameters.threadId,
        boardUri : boardData.boardUri
      }, {
        _id : 0,
        subject : 1,
        creation : 1,
        threadId : 1,
        id : 1,
        postId : 1,
        name : 1,
        files : 1,
        email : 1,
        banMessage : 1,
        message : 1
      }).sort({
        creation : 1
      }).toArray(function gotPosts(error, posts) {
        if (error) {
          formOps.outputError(error, 500, res);
        } else {
          outputModData(boardData, thread, posts, res);
        }

      });

      // style exception, too simple
    }

  });

}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, false,
      function gotData(auth, userData) {

        var parameters = url.parse(req.url, true).query;

        if (formOps.checkBlankParameters(parameters,
            [ 'boardUri', 'threadId' ], res)) {
          return;
        }

        var globalStaff = userData.globalRole > miscOps.getMaxStaffRole();

        // style exception, too simple
        boards.findOne({
          boardUri : parameters.boardUri
        }, {
          owner : 1,
          _id : 0,
          boardUri : 1,
          boardName : 1,
          settings : 1,
          boardDescription : 1,
          volunteers : 1
        }, function gotBoard(error, board) {
          if (error) {
            formOps.outputError(error, 500, res);
          } else if (!board) {
            formOps.outputError('Board not found', 500, res);
          } else if (!modOps.isInBoardStaff(userData, board) && globalStaff) {
            formOps.outputError('You are not allowed to moderate this board.',
                500, res);
          } else {
            getPostingData(board, parameters, res);
          }
        });
        // style exception, too simple

      });

};