'use strict';

// handles the final part of page generation. I created this so I would take
// some stuff out of generator.js since that file was becoming a huge mess

var gridFs = require('./gridFsHandler');
var serializer = require('jsdom').serializeDocument;
var verbose = require('../boot').getGeneralSettings().verbose;

exports.notFound = function(document, callback) {

  // TODO

  gridFs.writeData(serializer(document), '/404.html', 'text/html', {
    status : 404
  }, callback);
};

exports.frontPage = function(document, boards, callback) {

  if (verbose) {
    console.log('Got boards\n' + JSON.stringify(boards));

  }

  var boardsDiv = document.getElementById('divBoards');

  if (!boardsDiv) {
    callback('No board div on front-end template');
    return;
  }

  for (var i = 0; i < boards.length; i++) {

    var board = boards[i];

    var block = '<a href="' + board.boardUri + '">';
    block += '/' + board.boardUri + '/ - ' + board.boardName + '</a>';

    if (i) {
      block = '<br>' + block;
    }

    boardsDiv.innerHTML += block;

  }

  gridFs.writeData(serializer(document), '/', 'text/html', {}, callback);
};

function generatePostListing(document, boardUri, threads, callback) {

  var postsDiv = document.getElementById('divPosts');

  if (!postsDiv) {
    callback('No posts div on thread template page');

    return;
  }

  var postsContent = '';

  for (var i = 0; i < threads.length; i++) {
    // TODO check if is the first post and change style

    var post = threads[i];

    postsContent += post.message + '<br><br>';
  }

  postsDiv.innerHTML = postsContent;

  var ownName = 'res/' + threads[0].postId + '.html';

  gridFs.writeData(serializer(document), '/' + boardUri + '/' + ownName,
      'text/html', {
        boardUri : boardUri,
        type : 'board'
      }, callback);
}

exports.thread = function(document, boardUri, boardData, threads, callback) {
  var boardIdentifyInput = document.getElementById('boardIdentifier');

  if (!boardIdentifyInput) {
    callback('No board identify input on thread template page');
    return;
  }

  if (!setBoardTitleAndDescription(document, callback, boardUri, boardData)) {
    return;
  }

  generatePostListing(document, boardUri, threads, callback);
};

function setBoardTitleAndDescription(document, callback, boardUri, boardData) {

  var titleHeader = document.getElementById('labelName');

  if (!titleHeader) {
    callback('No title header on template');
    return false;
  }

  titleHeader.innerHTML = boardUri;

  var descriptionHeader = document.getElementById('labelDescription');

  if (!descriptionHeader) {
    callback('No description header on template');
    return false;
  }

  titleHeader.innerHTML = '/' + boardUri + '/ - ' + boardData.boardName;
  descriptionHeader.innerHTML = boardData.boardDescription;

  return true;

}

function setPagesListing(document, callback, pageCount, boardUri) {
  var pagesDiv = document.getElementById('divPages');

  if (!pagesDiv) {
    callback('No pages div on board page template');
    return false;
  }

  var pagesContent = '';

  for (var i = 0; i < pageCount; i++) {

    var pageName = i ? (i + 1) + '.html' : 'index.html';

    pagesContent += '<a href="' + pageName + '">' + (i + 1) + '</a>  ';

  }

  pagesDiv.innerHTML = pagesContent;

  return true;
}

function generateThreadListing(document, boardUri, page, threads, callback) {
  var threadsDiv = document.getElementById('divThreads');

  if (!threadsDiv) {
    callback('No threads div on board page template');
    return;
  }

  var includedThreads = [];

  for (var i = 0; i < threads.length; i++) {
    var thread = threads[i];

    includedThreads.push(thread.postId);

    if (i) {
      threadsDiv.innerHTML += '<br>';
    }

    var content = thread.postId + '<a href="res/' + thread.postId + '.html';
    content += '">Reply</a>';

    threadsDiv.innerHTML += content;

  }

  var ownName = page === 1 ? '' : page + '.html';

  gridFs.writeData(serializer(document), '/' + boardUri + '/' + ownName,
      'text/html', {
        boardUri : boardUri,
        type : 'board'
      }, callback);
}

exports.page = function(document, boardUri, page, threads, pageCount,
    boardData, callback) {

  var boardIdentifyInput = document.getElementById('boardIdentifier');

  if (!boardIdentifyInput) {
    callback('No board identify input on board template page');
    return;
  }

  boardIdentifyInput.setAttribute('value', boardUri);

  if (!setBoardTitleAndDescription(document, callback, boardUri, boardData)) {
    return;
  }

  if (!setPagesListing(document, callback, pageCount, boardUri)) {
    return;
  }

  generateThreadListing(document, boardUri, page, threads, callback);
};
