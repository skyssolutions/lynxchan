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
var debug = boot.debug();
var fs = require('fs');
var frontPageTemplate;
var threadTemplate;
var boardTemplate;
var notFoundTemplate;
var messageTemplate;

require('jsdom').defaultDocumentFeatures = {
  FetchExternalResources : false,
  ProcessExternalResources : false,
  // someone said it might break stuff. If weird bugs, disable.
  MutationEvents : false
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

    if (debug) {
      throw error;
    }

    return error.toString;
  }

};

exports.frontPage = function(boards, callback) {

  if (verbose) {
    console.log('Got boards\n' + JSON.stringify(boards));
  }

  try {

    var document = jsdom(frontPageTemplate);

    var boardsDiv = document.getElementById('divBoards');

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
  } catch (error) {
    callback(error);
  }
};

function generatePostListing(document, boardUri, thread, posts, callback) {

  var postsDiv = document.getElementById('divPosts');

  var postsContent = '';
  postsContent += 'OP: ' + thread.message + '<br><br>';

  for (var i = 0; i < posts.length; i++) {

    var post = posts[i];

    postsContent += post.message + '<br><br>';
  }

  postsDiv.innerHTML = postsContent;

  var ownName = 'res/' + thread.threadId + '.html';

  gridFs.writeData(serializer(document), '/' + boardUri + '/' + ownName,
      'text/html', {
        boardUri : boardUri,
        type : 'thread',
        threadId : thread.threadId
      }, callback);

}

exports.thread = function(boardUri, boardData, threadData, posts, callback) {

  try {
    var document = jsdom(threadTemplate);

    var titleHeader = document.getElementById('labelName');

    titleHeader.innerHTML = boardUri;

    var descriptionHeader = document.getElementById('labelDescription');

    titleHeader.innerHTML = '/' + boardUri + '/ - ' + boardData.boardName;
    descriptionHeader.innerHTML = boardData.boardDescription;

    var boardIdentifyInput = document.getElementById('boardIdentifier');

    boardIdentifyInput.setAttribute('value', boardUri);

    var threadIdentifyInput = document.getElementById('threadIdentifier');

    threadIdentifyInput.setAttribute('value', threadData.threadId);

    generatePostListing(document, boardUri, threadData, posts, callback);
  } catch (error) {
    callback(error);
  }

};

function generateThreadListing(document, boardUri, page, threads, callback) {
  var threadsDiv = document.getElementById('divThreads');

  if (!threadsDiv) {
    callback('No threads div on board page template');
    return;
  }

  var includedThreads = [];

  for (var i = 0; i < threads.length; i++) {
    var thread = threads[i];

    includedThreads.push(thread.threadId);

    if (i) {
      threadsDiv.innerHTML += '<br>';
    }

    var content = thread.threadId + '<a href="res/' + thread.threadId + '.html';
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

  try {

    var document = jsdom(boardTemplate);

    var boardIdentifyInput = document.getElementById('boardIdentifier');

    boardIdentifyInput.setAttribute('value', board);

    var titleHeader = document.getElementById('labelName');

    titleHeader.innerHTML = board;

    var descriptionHeader = document.getElementById('labelDescription');

    titleHeader.innerHTML = '/' + board + '/ - ' + boardData.boardName;
    descriptionHeader.innerHTML = boardData.boardDescription;

    var pagesDiv = document.getElementById('divPages');

    pagesDiv.innerHTML = '';

    for (var i = 0; i < pageCount; i++) {

      var pageName = i ? (i + 1) + '.html' : 'index.html';

      pagesDiv.innerHTML += '<a href="' + pageName + '">' + (i + 1) + '</a>  ';

    }

    generateThreadListing(document, board, page, threads, callback);
  } catch (error) {
    callback(error);
  }
};
