'use strict';

// any operation regarding posting
var db = require('../db');
var threads = db.threads();
var boards = db.boards();
var posts = db.posts();
var miscOps = require('./miscOps');

var newThreadParameters = [ {
  field : 'subject',
  length : 128
}, {
  field : 'email',
  length : 64
}, {
  field : 'name',
  length : 32
}, {
  field : 'message',
  length : 2048
} ];

function updateBoard(boardUri, threadId, callback) {

  boards.update({
    boardUri : boardUri
  }, {
    $set : {
      lastPostId : threadId
    },
    $inc : {
      threadCount : 1
    }
  }, function updatedBoard(error, result) {
    if (error) {
      callback(error);
    } else {

      // signal rebuild of board pages
      process.send({
        board : boardUri
      });

      // signal rebuild of thread
      process.send({
        board : boardUri,
        thread : threadId
      });

      callback(null, threadId);

    }
  });
}

function createThread(parameters, threadId, callback) {

  miscOps.sanitizeStrings(parameters, newThreadParameters);

  var threadToAdd = {
    boardUri : parameters.boardUri,
    threadId : threadId,
    lastBump : new Date(),
    creation : new Date(),
    subject : parameters.subject,
    name : parameters.name,
    message : parameters.message,
    email : parameters.email
  };

  threads.insert(threadToAdd, function createdThread(error) {
    if (error && error.code === 11000) {
      createThread(parameters, threadId + 1, callback);
    } else if (error) {
      callback(error);
    } else {
      updateBoard(parameters.boardUri, threadId, callback);
    }
  });

}

exports.newThread = function(req, parameters, callback) {

  boards.find({
    boardUri : parameters.boardUri
  }, {
    _id : 0,
    lastPostId : 1
  }, function gotBoard(error, board) {
    if (error) {
      callback(error);
    } else if (!board) {
      callback('Board not found');
    } else {
      createThread(parameters, (board.lastPostId || 0) + 1, callback);
    }
  });

};