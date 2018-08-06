'use strict';

// builds RSS versions of pages

var rssDomain;
var cacheHandler;
var overboard;
var sfwOverboard;

exports.loadSettings = function() {

  var settings = require('../settingsHandler').getGeneralSettings();

  overboard = settings.overboard;
  sfwOverboard = settings.sfwOverboard;
  rssDomain = settings.rssDomain;

};

exports.loadDependencies = function() {

  cacheHandler = require('./cacheHandler');

};

exports.getSanitizedSubject = function(thread) {

  if (thread.subject) {
    return thread.subject.replace(/&/g, '&amp;');
  } else {
    return '<![CDATA[ ' + thread.message.substring(0, 256) + ' ]]>';
  }

};

exports.getThreads = function(threads) {

  var rssContent = '';

  for (var i = 0; i < threads.length; i++) {

    var thread = threads[i];

    rssContent += '<item><title>';

    rssContent += exports.getSanitizedSubject(thread);

    rssContent += '</title><link>' + rssDomain + '/';
    rssContent += thread.boardUri + '/res/' + thread.threadId + '.html</link>';

    rssContent += '<description><![CDATA[ ' + thread.markdown;
    rssContent += ' ]]></description>';

    rssContent += '<pubDate>' + thread.creation.toUTCString().substring(0, 25);
    rssContent += '</pubDate>';

    rssContent += '</item>';

  }

  return rssContent;

};

exports.getBoilerPlate = function(boardData) {

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

  return rssContent;

};

exports.board = function(boardData, threads, callback) {

  var rssContent = exports.getBoilerPlate(boardData);

  rssContent += exports.getThreads(threads);

  rssContent += '</channel></rss>';

  var ownName = '/' + boardData.boardUri + '/index.rss';

  var uri = boardData.boardUri;

  cacheHandler.writeData(rssContent, ownName, 'application/rss+xml', {
    boardUri : boardData.boardUri,
    type : uri === overboard || uri === sfwOverboard ? 'overboard' : 'catalog'
  }, callback);

};