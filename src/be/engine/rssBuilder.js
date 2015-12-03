'use strict';

// builds RSS versions of pages

var settings = require('../settingsHandler').getGeneralSettings();
var gridFsHandler;

exports.loadDependencies = function() {

  gridFsHandler = require('./gridFsHandler');

};

exports.getThreads = function(threads) {

  var rssContent = '';

  for (var i = 0; i < threads.length; i++) {

    var thread = threads[i];

    rssContent += '<item>';

    rssContent += '<title>' + (thread.subject || thread.message) + '</title>';

    rssContent += '<link>' + settings.rssDomain + '/' + thread.boardUri;
    rssContent += '/res/' + thread.threadId + '.html</link>';

    rssContent += '<description>' + thread.message + '</description>';

    rssContent += '<pubDate>' + thread.creation.toUTCString().substring(0, 25);
    rssContent += '</pubDate>';

    rssContent += '</item>';

  }

  return rssContent;

};

exports.board = function(boardData, threads, callback) {

  var rssContent = '<?xml version="1.0" encoding="UTF-8"?>';
  rssContent += '<rss version="2.0"><channel>';

  rssContent += '<title>/' + boardData.boardUri + '/';

  if (boardData.boardName) {
    rssContent += ' - ' + boardData.boardName;
  }

  rssContent += '</title>';

  if (boardData.boardDescription) {
    rssContent += '<description>' + boardData.boardDescription;
    rssContent += '</description>';
  }

  rssContent += exports.getThreads(threads);

  rssContent += '</channel></rss>';

  var ownName = '/' + boardData.boardUri + '/index.rss';

  gridFsHandler.writeData(rssContent, ownName, 'application/rss+xml', {
    boardUri : boardData.boardUri,
    type : 'board'
  }, callback);

};