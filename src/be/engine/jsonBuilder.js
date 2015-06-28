'use strict';

// builds static JSON
// json counterpart of domManipulator

var gridFsHandler = require('./gridFsHandler');

function getFileObject(file) {

  return {
    originalName : file.originalName,
    path : file.path,
    thumb : file.thumb,
    size : file.size,
    width : file.width,
    height : file.height
  };

}

function getPostObject(post) {
  return {
    name : post.name,
    signedRole : post.signedRole,
    email : post.email,
    postId : post.postId,
    id : post.id,
    subject : post.subject,
    message : post.message,
    banMessage : post.banMessage,
    creation : post.creation
  };
}

function getThreadObject(thread) {

  return {
    signedRole : thread.signedRole,
    banMessage : thread.banMessage,
    id : thread.id,
    name : thread.name,
    email : thread.email,
    threadId : thread.threadId,
    subject : thread.subject,
    message : thread.message,
    creation : thread.creation,
    locked : thread.locked ? true : false,
    pinned : thread.pinned ? true : false
  };
}

// start of thread creation
function buildThreadPosts(posts) {
  var threadPosts = [];

  for (var i = 0; i < posts.length; i++) {

    var post = posts[i];

    var postToAdd = getPostObject(post);

    if (post.files) {

      var postFiles = [];

      for (var j = 0; j < post.files.length; j++) {

        postFiles.push(getFileObject(post.files[j]));

      }

      postToAdd.files = postFiles;

    }

    threadPosts.push(postToAdd);

  }

  return threadPosts;
}

exports.thread = function(boardUri, boardData, threadData, posts, callback) {

  var finalJson = getThreadObject(threadData);

  var threadFiles = [];

  if (threadData.files) {

    for (var i = 0; i < threadData.files.length; i++) {
      threadFiles.push(getFileObject(threadData.files[i]));
    }
  }

  finalJson.posts = buildThreadPosts(posts || []);
  finalJson.files = threadFiles;

  var path = '/' + boardUri + '/res/' + threadData.threadId + '.json';

  gridFsHandler.writeData(JSON.stringify(finalJson), path, 'application/json',
      {
        boardUri : boardUri,
        threadId : threadData.threadId,
        type : 'thread'
      }, callback);
};
// end of thread creation

exports.frontPage = function(boards, callback) {

  var topBoards = [];

  for (var i = 0; i < boards.length; i++) {

    var board = boards[i];

    topBoards.push({
      boardUri : board.boardUri,
      boardName : board.boardName
    });

  }

  var finalJson = {
    topBoards : topBoards
  };

  gridFsHandler.writeData(JSON.stringify(finalJson), '/index.json',
      'application/json', {}, callback);

};

exports.preview = function(postingData, callback) {

  var finalJson = {
    name : postingData.name,
    signedRole : postingData.signedRole,
    email : postingData.email,
    id : postingData.id,
    subject : postingData.subject,
    message : postingData.message,
    banMessage : postingData.banMessage,
    creation : postingData.creation
  };

  var path = '/' + postingData.boardUri + '/preview/';

  var metadata = {
    boardUri : postingData.boardUri,
    threadId : postingData.threadId,
    type : 'preview'
  };

  if (postingData.postId) {
    metadata.postId = postingData.postId;
    path += postingData.postId;
  } else {
    path += postingData.threadId;
  }

  path += '.json';

  gridFsHandler.writeData(JSON.stringify(finalJson), path, 'application/json',
      metadata, callback);

};
