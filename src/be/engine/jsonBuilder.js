'use strict';

// builds static JSON
// json counterpart of domManipulator

var gridFsHandler = require('./gridFsHandler');

// start of shared functions
function getFilesArray(fileArray) {

  var toReturn = [];

  if (fileArray) {
    for (var i = 0; i < fileArray.length; i++) {
      var file = fileArray[i];

      toReturn.push({
        originalName : file.originalName,
        path : file.path,
        thumb : file.thumb,
        mime : file.mime,
        name : file.name,
        size : file.size,
        width : file.width,
        height : file.height
      });

    }
  }

  return toReturn;

}

function getPostObject(post, preview) {
  var toReturn = {
    name : post.name,
    signedRole : post.signedRole,
    email : post.email,
    flag : post.flag,
    flagName : post.flagName,
    id : post.id,
    subject : post.subject,
    lastEditTime : post.lastEditTime,
    lastEditLogin : post.lastEditLogin,
    markdown : post.markdown,
    message : post.message,
    banMessage : post.banMessage,
    creation : post.creation,
    files : getFilesArray(post.files)
  };

  if (!preview) {
    toReturn.postId = post.postId;
  }

  return toReturn;
}

function buildThreadPosts(posts) {
  var threadPosts = [];

  if (posts) {

    for (var i = 0; i < posts.length; i++) {

      var post = posts[i];

      var postToAdd = getPostObject(post);

      threadPosts.push(postToAdd);

    }
  }

  return threadPosts;
}

function getThreadObject(thread, posts) {

  return {
    signedRole : thread.signedRole,
    banMessage : thread.banMessage,
    id : thread.id,
    name : thread.name,
    email : thread.email,
    threadId : thread.threadId,
    flag : thread.flag,
    flagName : thread.flagName,
    subject : thread.subject,
    lastEditTime : thread.lastEditTime,
    lastEditLogin : thread.lastEditLogin,
    markdown : thread.markdown,
    message : thread.message,
    creation : thread.creation,
    locked : thread.locked ? true : false,
    pinned : thread.pinned ? true : false,
    cyclic : thread.cyclic ? true : false,
    files : getFilesArray(thread.files),
    posts : buildThreadPosts(posts)
  };
}
// end of shared functions

exports.thread = function(boardUri, boardData, flagData, threadData, posts,
    callback) {

  var path = '/' + boardUri + '/res/' + threadData.threadId + '.json';

  gridFsHandler.writeData(JSON.stringify(getThreadObject(threadData, posts)),
      path, 'application/json', {
        boardUri : boardUri,
        threadId : threadData.threadId,
        type : 'thread'
      }, callback);
};

exports.frontPage = function(boards, callback) {

  var topBoards = [];

  for (var i = 0; i < boards.length; i++) {

    var board = boards[i];

    topBoards.push({
      boardUri : board.boardUri,
      boardName : board.boardName
    });

  }

  gridFsHandler.writeData(JSON.stringify({
    topBoards : topBoards
  }), '/index.json', 'application/json', {}, callback);

};

exports.preview = function(postingData, callback) {

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

  gridFsHandler.writeData(JSON.stringify(getPostObject(postingData, true)),
      path, 'application/json', metadata, callback);

};

exports.page = function(boardUri, page, threads, pageCount, boardData,
    flagData, latestPosts, callback) {

  var threadsToAdd = [];

  if (threads) {

    var tempLatest = {};

    for (var i = 0; i < latestPosts.length; i++) {

      tempLatest[latestPosts[i]._id] = latestPosts[i].latestPosts;
    }

    latestPosts = tempLatest;

    for (i = 0; i < threads.length; i++) {
      var thread = threads[i];

      threadsToAdd.push(getThreadObject(thread, latestPosts[thread.threadId]));

    }
  }

  var ownName = '/' + boardUri + '/' + page + '.json';

  gridFsHandler.writeData(JSON.stringify({
    pageCount : pageCount,
    boardName : boardData.boardName,
    boardDescription : boardData.boardDescription,
    settings : boardData.settings,
    threads : threadsToAdd
  }), ownName, 'application/json', {
    boardUri : boardUri,
    type : 'board'
  }, callback);

};

exports.catalog = function(boardUri, threads, callback) {

  var threadsArray = [];

  for (var i = 0; i < threads.length; i++) {
    var thread = threads[i];

    var threadToPush = {
      message : thread.message,
      threadId : thread.threadId,
      postCount : thread.postCount,
      fileCount : thread.fileCount,
      page : thread.page,
      subject : thread.subject,
      locked : thread.locked ? true : false,
      pinned : thread.pinned ? true : false,
      cyclic : thread.cyclic ? true : false
    };

    if (thread.files && thread.files.length) {
      threadToPush.thumb = thread.files[0].thumb;
    }

    threadsArray.push(threadToPush);
  }

  var path = '/' + boardUri + '/catalog.json';

  gridFsHandler.writeData(JSON.stringify(threadsArray), path,
      'application/json', {
        boardUri : boardUri,
        type : 'catalog'
      }, callback);

};

exports.rules = function(boardUri, rules, callback) {
  gridFsHandler.writeData(JSON.stringify(rules),
      '/' + boardUri + '/rules.json', 'application/json', {
        boardUri : boardUri,
        type : 'rules'
      }, callback);
};