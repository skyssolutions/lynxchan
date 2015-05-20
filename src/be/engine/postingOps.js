'use strict';

// any operation regarding posting
var db = require('../db');
var posts = db.posts();
var miscOps = require('./miscOps');
var boards = db.boards();
var parametersToSanitize = [ {
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

function createThread(parameters, threadId, callback) {

  miscOps.sanitizeStrings(parameters, parametersToSanitize);

  var threadToAdd = {
    boardUri : parameters.boardUri,
    postId : threadId,
    lastBump : new Date(),
    creation : new Date(),
    subject : parameters.subject,
    name : parameters.name,
    message : parameters.message,
    email : parameters.email
  };

  posts.insert(threadToAdd, function createdThread(error) {
    if (error && error.code === 11000) {
      createThread(parameters, threadId + 1, callback);
    } else if (error) {
      callback(error);
    } else {
      callback(null, threadId);
    }
  });

}

exports.newThread = function(req, parameters, callback) {

  boards.findAndModify({
    boardUri : parameters.boardUri
  }, [], {
    $inc : {
      lastPostId : 1
    }
  }, {
    'new' : true
  }, function gotBoard(error, board) {
    if (error) {
      callback(error);
    } else if (!board) {
      callback('Board not found');
    } else {
      createThread(parameters, board.value.lastPostId, callback);
    }
  });

};