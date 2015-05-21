'use strict';

// handles the final part of page generation. I created this so I would take
// some stuff out of generator.js since that file was becoming a huge mess

// also, manipulations that are not persistent are meant to be directly
// requested from this module

var gridFs = require('./gridFsHandler');
var serializer = require('jsdom').serializeDocument;
var verbose = require('../boot').getGeneralSettings().verbose;
var jsdom = require('jsdom').jsdom;
var boot = require('../boot');
var fs = require('fs');
var frontPageTemplate;
var threadTemplate;
var boardTemplate;
var notFoundTemplate;
var messageTemplate;

require('jsdom').defaultDocumentFeatures = {
  FetchExternalResources : false
};

exports.loadTemplates = function() {

  var fePath = boot.getFePath() + '/templates/';
  var templateSettings = boot.getTemplateSettings();

  frontPageTemplate = fs.readFileSync(fePath + templateSettings.index);
  threadTemplate = fs.readFileSync(fePath + templateSettings.threadPage);
  boardTemplate = fs.readFileSync(fePath + templateSettings.boardPage);
  notFoundTemplate = fs.readFileSync(fePath + templateSettings.notFoundPage);
  messageTemplate = fs.readFileSync(fePath + templateSettings.messagePage);

};

exports.notFound = function(callback) {

  var document = jsdom(notFoundTemplate);

  gridFs.writeData(serializer(document), '/404.html', 'text/html', {
    status : 404
  }, callback);
};

exports.message = function(message, link) {

  try {

    var document = jsdom(messageTemplate);

    var messageLabel = document.getElementById('labelMessage');

    messageLabel.innerHTML = message;

    var redirectLink = document.getElementById('linkRedirect');

    redirectLink.href = link;

    var meta = document.createElement('META');

    meta.httpEquiv = 'refresh';
    meta.content = '3; url=' + link;

    document.getElementsByTagName('head')[0].appendChild(meta);

    return serializer(document);
  } catch (error) {
    if (verbose) {
      console.log('error ' + error);
    }
    return error.toString;
  }

};

exports.frontPage = function(boards, callback) {

  if (verbose) {
    console.log('Got boards\n' + JSON.stringify(boards));

  }

  var document = jsdom(frontPageTemplate);

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

exports.thread = function(boardUri, boardData, threads, callback) {

  var document = jsdom(threadTemplate);

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

exports.page = function(board, page, threads, pageCount, boardData, callback) {

  var document = jsdom(boardTemplate);

  var boardIdentifyInput = document.getElementById('boardIdentifier');

  if (!boardIdentifyInput) {
    callback('No board identify input on board template page');
    return;
  }

  boardIdentifyInput.setAttribute('value', board);

  if (!setBoardTitleAndDescription(document, callback, board, boardData)) {
    return;
  }

  if (!setPagesListing(document, callback, pageCount, board)) {
    return;
  }

  generateThreadListing(document, board, page, threads, callback);
};
