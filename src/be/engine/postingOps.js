'use strict';

// any operation regarding posting
var db = require('../db');
var threads = db.threads();
var boards = db.boards();
var posts = db.posts();
var miscOps = require('./miscOps');
var uploadHandler = require('./uploadHandler');
var delOps = require('./deletionOps');
var settings = require('../boot').getGeneralSettings();
var previewPosts = settings.previewPostCount;
var threadLimit = settings.maxThreadCount;

var postingParameters = [ {
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
}, {
  field : 'password',
  length : 8
} ];

// start of thread creation
function finishThreadCreation(boardUri, threadId, callback) {
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

function updateBoardForThreadCreation(boardUri, threadId, callback) {

  boards.findOneAndUpdate({
    boardUri : boardUri
  }, {
    $set : {
      lastPostId : threadId
    },
    $inc : {
      threadCount : 1
    }
  }, {
    returnOriginal : false
  }, function updatedBoard(error, board) {
    if (error) {
      callback(error);
    } else {

      if (board.value.threadCount > threadLimit) {

        // style exception, too simple
        delOps.cleanThreads(boardUri, function cleanedThreads(error) {
          if (error) {
            callback(error);
          } else {
            finishThreadCreation(boardUri, threadId, callback);
          }
        });
        // style exception, too simple

      } else {
        finishThreadCreation(boardUri, threadId, callback);
      }

    }
  });
}

function createThread(parameters, threadId, callback) {

  miscOps.sanitizeStrings(parameters, postingParameters);

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

  if (parameters.password) {
    threadToAdd.password = parameters.password;
  }

  threads.insert(threadToAdd, function createdThread(error) {
    if (error && error.code === 11000) {
      createThread(parameters, threadId + 1, callback);
    } else if (error) {
      callback(error);
    } else {

      // style exception, too simple
      uploadHandler.saveUploads(parameters.boardUri, threadId, null,
          parameters.files, function savedUploads(error) {
            if (error) {
              callback(error);
            } else {
              updateBoardForThreadCreation(parameters.boardUri, threadId,
                  callback);
            }
          });
      // style exception, too simple

    }
  });

}

exports.newThread = function(req, parameters, callback) {

  boards.findOne({
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
// end of thread creation

// start of post creation

function updateBoardForPostCreation(parameters, postId, thread, callback) {

  if (parameters.email !== 'sage') {

    for (var i = 0; i < (thread.page || 1); i++) {

      // signal rebuild of board pages
      process.send({
        board : parameters.boardUri,
        page : i + 1
      });
    }
  } else if (thread.page) {
    process.send({
      board : parameters.boardUri,
      page : thread.page
    });
  }

  // signal rebuild of thread
  process.send({
    board : parameters.boardUri,
    thread : parameters.threadId
  });

  boards.update({
    boardUri : parameters.boardUri
  }, {
    $set : {
      lastPostId : postId
    }
  }, function updatedBoard(error, result) {
    if (error) {
      callback(error);
    } else {
      callback(null, postId);
    }
  });

}

function updateThread(parameters, postId, thread, callback) {

  var latestPosts = thread.latestPosts || [];

  latestPosts.push(postId);

  while (latestPosts.length > previewPosts) {
    latestPosts.shift();
  }

  var updateBlock = {
    $set : {
      latestPosts : latestPosts
    },
    $inc : {
      postCount : 1
    }
  };

  if (parameters.email !== 'sage') {
    updateBlock.$set.lastBump = new Date();
  }

  threads.update({
    boardUri : parameters.boardUri,
    threadId : parameters.threadId
  }, updateBlock, function updatedThread(error, result) {
    if (error) {
      callback(error);
    } else {
      updateBoardForPostCreation(parameters, postId, thread, callback);
    }

  });

}

function createPost(parameters, postId, thread, callback) {

  miscOps.sanitizeStrings(parameters, postingParameters);

  var postToAdd = {
    boardUri : parameters.boardUri,
    postId : postId,
    threadId : parameters.threadId,
    creation : new Date(),
    subject : parameters.subject,
    name : parameters.name,
    message : parameters.message,
    email : parameters.email
  };

  if (parameters.password) {
    postToAdd.password = parameters.password;
  }

  posts.insert(postToAdd, function createdPost(error) {
    if (error && error.code === 11000) {
      createPost(parameters, postId + 1, thread, callback);
    } else if (error) {
      callback(error);
    } else {

      // style exception, too simple
      uploadHandler.saveUploads(parameters.boardUri, parameters.threadId,
          postId, parameters.files, function savedFiles(error) {
            if (error) {
              callback(error);
            } else {
              updateThread(parameters, postId, thread, callback);
            }

          });
      // style exception, too simple

    }
  });

}

function getThread(parameters, postId, callback) {

  threads.findOne({
    boardUri : parameters.boardUri,
    threadId : parameters.threadId
  }, {
    latestPosts : 1,
    page : 1,
    _id : 1
  }, function gotThread(error, thread) {
    if (error) {
      callback(error);
    } else if (!thread) {
      callback('Thread not found');
    } else {
      createPost(parameters, postId, thread, callback);
    }
  });

}

exports.newPost = function(req, parameters, callback) {

  parameters.threadId = +parameters.threadId;

  boards.findOne({
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
      getThread(parameters, (board.lastPostId || 0) + 1, callback);
    }
  });

};
// end of post creation
