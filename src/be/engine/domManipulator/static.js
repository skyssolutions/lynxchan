'use strict';

var jsdom = require('jsdom').jsdom;
var serializer = require('jsdom').serializeDocument;
var settings = require('../../settingsHandler').getGeneralSettings();
var archive = settings.archiveLevel > 0 && require('../../archive').loaded();
var common;
var templateHandler;
var lang;
var gridFs;
var siteTitle;

var accountCreationDisabled = settings.disableAccountCreation;

exports.loadDependencies = function() {

  common = require('.').common;
  templateHandler = require('../templateHandler');
  lang = require('../langOps').languagePack();
  gridFs = require('../gridFsHandler');
  siteTitle = settings.siteTitle || lang.titDefaultChanTitle;

};

exports.notFound = function(callback) {

  try {
    var document = jsdom(templateHandler.notFoundPage);

    document.title = lang.titNotFound;

    gridFs.writeData(serializer(document), '/404.html', 'text/html', {
      status : 404
    }, callback);
  } catch (error) {
    callback(error);
  }

};

exports.login = function(callback) {

  try {
    var document = jsdom(templateHandler.loginPage);

    document.title = lang.titLogin;

    if (accountCreationDisabled) {
      common.removeElement(document.getElementById('divCreation'));
    }

    gridFs.writeData(serializer(document), '/login.html', 'text/html', {},
        callback);

  } catch (error) {
    callback(error);
  }

};

// Section 1: Thread {
exports.setThreadHiddenIdentifiers = function(document, boardUri, threadData) {
  var boardIdentifyInput = document.getElementById('boardIdentifier');

  boardIdentifyInput.setAttribute('value', boardUri);

  var threadIdentifyInput = document.getElementById('threadIdentifier');

  threadIdentifyInput.setAttribute('value', threadData.threadId);
};

exports.setModdingInformation = function(document, boardUri, boardData,
    threadData, posts, callback) {

  if (threadData.locked) {
    document.getElementById('checkboxLock').setAttribute('checked', true);
  }

  if (threadData.pinned) {
    document.getElementById('checkboxPin').setAttribute('checked', true);
  }

  if (threadData.cyclic) {
    document.getElementById('checkboxCyclic').setAttribute('checked', true);
  }

  document.getElementById('controlBoardIdentifier').setAttribute('value',
      boardUri);
  document.getElementById('controlThreadIdentifier').setAttribute('value',
      threadData.threadId);

  callback(null, serializer(document));

};

exports.hideModElements = function(document) {

  common.removeElement(document.getElementById('inputBan'));
  common.removeElement(document.getElementById('divBanInput'));
  common.removeElement(document.getElementById('divControls'));

};

exports.setThreadTitle = function(document, boardUri, threadData) {
  var title = '/' + boardUri + '/ - ';

  if (threadData.subject) {
    title += threadData.subject;
  } else {
    title += threadData.message.substring(0, 256);
  }

  document.title = title;
};

exports.setModElements = function(modding, document, boardUri, boardData,
    threadData, posts, callback) {

  if (modding) {

    exports.setModdingInformation(document, boardUri, boardData, threadData,
        posts, callback);

  } else {
    exports.hideModElements(document);
    var ownName = 'res/' + threadData.threadId + '.html';

    gridFs.writeData(serializer(document), '/' + boardUri + '/' + ownName,
        'text/html', {
          boardUri : boardUri,
          type : 'thread',
          threadId : threadData.threadId
        }, callback, archive && boardData.settings.indexOf('archive') > -1);
  }
};

exports.thread = function(boardUri, boardData, flagData, threadData, posts,
    callback, modding, userRole) {

  try {
    var document = jsdom(templateHandler.threadPage);

    exports.setThreadTitle(document, boardUri, threadData);

    var linkModeration = '/mod.js?boardUri=' + boardData.boardUri;
    linkModeration += '&threadId=' + threadData.threadId;

    var moderationElement = document.getElementById('linkMod');
    moderationElement.href = linkModeration;

    var linkManagement = document.getElementById('linkManagement');
    linkManagement.href = '/boardManagement.js?boardUri=' + boardData.boardUri;

    common.setHeader(document, boardUri, boardData, flagData);

    exports.setThreadHiddenIdentifiers(document, boardUri, threadData);

    common.addThread(document, threadData, posts, boardUri, true, modding,
        boardData, userRole);

    exports.setModElements(modding, document, boardUri, boardData, threadData,
        posts, callback, userRole);

  } catch (error) {
    callback(error);
  }

};
// } Section 1: Thread

// Section 2: Board {
exports.generateThreadListing = function(document, boardUri, page, threads,
    latestPosts, callback) {

  var tempLatest = {};

  for (var i = 0; i < latestPosts.length; i++) {

    tempLatest[latestPosts[i]._id] = latestPosts[i].latestPosts;
  }

  latestPosts = tempLatest;

  for (i = 0; i < threads.length; i++) {
    var thread = threads[i];

    common.addThread(document, thread, latestPosts[thread.threadId], boardUri);

  }

  var ownName = page === 1 ? '' : page + '.html';

  gridFs.writeData(serializer(document), '/' + boardUri + '/' + ownName,
      'text/html', {
        boardUri : boardUri,
        type : 'board'
      }, callback);
};

exports.addPagesLinks = function(document, pageCount, currentPage) {

  var previous = document.getElementById('linkPrevious');
  if (currentPage === 1) {
    common.removeElement(previous);
  } else {
    previous.href = currentPage > 2 ? currentPage - 1 + '.html' : 'index.html';
  }

  var next = document.getElementById('linkNext');
  if (pageCount === currentPage) {
    common.removeElement(next);
  } else {
    next.href = (currentPage + 1) + '.html';
  }

  var pagesDiv = document.getElementById('divPages');

  for (var i = 0; i < pageCount; i++) {

    var pageName = i ? (i + 1) + '.html' : 'index.html';

    var link = document.createElement('a');
    link.href = pageName;
    link.innerHTML = i + 1;

    pagesDiv.appendChild(link);

  }
};

exports.page = function(board, page, threads, pageCount, boardData, flagData,
    latestPosts, cb) {

  try {

    var document = jsdom(templateHandler.boardPage);

    document.title = '/' + board + '/' + ' - ' + boardData.boardName;

    var linkManagement = document.getElementById('linkManagement');
    linkManagement.href = '/boardManagement.js?boardUri=' + board;

    var linkModeration = document.getElementById('linkModeration');
    linkModeration.href = '/boardModeration.js?boardUri=' + board;

    var boardIdentifyInput = document.getElementById('boardIdentifier');

    boardIdentifyInput.setAttribute('value', board);

    common.setHeader(document, board, boardData, flagData);

    exports.addPagesLinks(document, pageCount, page);

    exports.generateThreadListing(document, board, page, threads, latestPosts,
        cb);
  } catch (error) {
    cb(error);
  }
};
// } Section 2: Board

// Section 3: Catalog {

exports.setCellThumb = function(thumbLink, boardUri, document, thread) {
  thumbLink.href = '/' + boardUri + '/res/' + thread.threadId + '.html';

  if (thread.files && thread.files.length) {
    var thumbImage = document.createElement('img');

    thumbImage.src = thread.files[0].thumb;
    thumbLink.appendChild(thumbImage);
  } else {
    thumbLink.innerHTML = lang.guiOpen;
  }
};

exports.setCell = function(boardUri, document, cell, thread) {

  exports.setCellThumb(cell.getElementsByClassName('linkThumb')[0], boardUri,
      document, thread);

  var labelReplies = cell.getElementsByClassName('labelReplies')[0];
  labelReplies.innerHTML = thread.postCount || 0;

  var labelImages = cell.getElementsByClassName('labelImages')[0];
  labelImages.innerHTML = thread.fileCount || 0;
  cell.getElementsByClassName('labelPage')[0].innerHTML = thread.page;
  if (thread.subject) {
    cell.getElementsByClassName('labelSubject')[0].innerHTML = thread.subject;
  }

  for ( var key in common.indicatorsRelation) {
    if (!thread[key]) {
      common.removeElement(cell
          .getElementsByClassName(common.indicatorsRelation[key])[0]);
    }
  }

  cell.getElementsByClassName('divMessage')[0].innerHTML = thread.markdown;

};

exports.catalog = function(boardUri, threads, callback) {

  try {

    var document = jsdom(templateHandler.catalogPage);

    document.title = lang.titCatalog.replace('{$board}', boardUri);

    document.getElementById('labelBoard').innerHTML = '/' + boardUri + '/';

    var threadsDiv = document.getElementById('divThreads');

    for (var i = 0; i < threads.length; i++) {
      var thread = threads[i];

      var cell = document.createElement('div');
      cell.innerHTML = templateHandler.catalogCell;
      cell.setAttribute('class', 'catalogCell');

      exports.setCell(boardUri, document, cell, thread);

      threadsDiv.appendChild(cell);
    }

    gridFs.writeData(serializer(document), '/' + boardUri + '/catalog.html',
        'text/html', {
          boardUri : boardUri,
          type : 'catalog'
        }, callback);

  } catch (error) {
    callback(error);
  }

};

// } Section 3: Catalog

// Section 4: Front page {
exports.setTopBoards = function(document, boards, boardsDiv) {

  for (var i = 0; i < boards.length; i++) {

    var board = boards[i];

    var link = document.createElement('a');

    link.href = '/' + board.boardUri + '/';
    link.innerHTML = '/' + board.boardUri + '/ - ' + board.boardName;

    if (i) {
      boardsDiv.appendChild(document.createElement('br'));
    }

    boardsDiv.appendChild(link);

  }

};

exports.setLatestPost = function(latestPosts, latestPostsDiv, document) {

  for (var i = 0; i < latestPosts.length; i++) {
    var post = latestPosts[i];

    var cell = document.createElement('div');
    cell.innerHTML = templateHandler.latestPostCell;

    var previewLabel = cell.getElementsByClassName('labelPreview')[0];
    previewLabel.innerHTML = post.previewText;

    var link = cell.getElementsByClassName('linkPost')[0];

    var postLink = '/' + post.boardUri + '/res/' + post.threadId + '.html';
    postLink += '#' + (post.postId || post.threadId);

    link.href = postLink;

    var linkText = '>>/' + post.boardUri + '/' + (post.postId || post.threadId);

    link.innerHTML = linkText;

    latestPostsDiv.appendChild(cell);

  }

};

exports.frontPage = function(boards, latestPosts, callback) {

  try {

    var document = jsdom(templateHandler.index);

    document.title = siteTitle;

    var boardsDiv = document.getElementById('divBoards');

    if (!boards) {
      common.removeElement(boardsDiv);
    } else {
      exports.setTopBoards(document, boards, boardsDiv);
    }

    var latestPostsDiv = document.getElementById('divLatestPosts');

    if (!latestPosts) {
      common.removeElement(latestPostsDiv);
    } else {
      exports.setLatestPost(latestPosts, latestPostsDiv, document);
    }

    gridFs.writeData(serializer(document), '/', 'text/html', {}, callback);
  } catch (error) {
    callback(error);
  }
};
// } Section 4: Front page

// Section 5: Preview {
exports.setMetadata = function(metadata, postingData, path) {

  if (postingData.postId) {
    metadata.postId = postingData.postId;

    path += postingData.postId;
  } else {
    postingData.postId = postingData.threadId;
    path += postingData.threadId;
  }

  return path;

};

exports.preview = function(postingData, callback) {
  try {

    var document = jsdom(templateHandler.previewPage);

    var path = '/' + postingData.boardUri + '/preview/';

    var metadata = {
      boardUri : postingData.boardUri,
      threadId : postingData.threadId,
      type : 'preview'
    };

    path = exports.setMetadata(metadata, postingData, path);

    path += '.html';

    var innerCell = document.createElement('div');
    innerCell.innerHTML = templateHandler.postCell;

    common.setPostInnerElements(document, postingData.boardUri,
        postingData.threadId, postingData, innerCell, true);

    document.getElementById('panelContent').appendChild(innerCell);

    if (postingData.postId === postingData.threadId) {
      delete postingData.postId;
    }

    gridFs.writeData(serializer(document), path, 'text/html', metadata,
        callback);

  } catch (error) {
    callback(error);
  }
};
// } Section 5: Preview

exports.rules = function(boardUri, rules, callback) {
  try {

    var document = jsdom(templateHandler.rulesPage);

    document.title = lang.titRules.replace('{$board}', boardUri);
    document.getElementById('boardLabel').innerHTML = boardUri;
    var rulesDiv = document.getElementById('divRules');

    for (var i = 0; i < rules.length; i++) {
      var cell = document.createElement('div');
      cell.innerHTML = templateHandler.ruleCell;

      cell.getElementsByClassName('textLabel')[0].innerHTML = rules[i];
      cell.getElementsByClassName('indexLabel')[0].innerHTML = i + 1;

      rulesDiv.appendChild(cell);
    }

    gridFs.writeData(serializer(document), '/' + boardUri + '/rules.html',
        'text/html', {
          boardUri : boardUri,
          type : 'rules'
        }, callback);

  } catch (error) {
    callback(error);
  }
};

exports.maintenance = function(callback) {
  try {

    var document = jsdom(templateHandler.maintenancePage);

    document.title = lang.titMaintenance;

    gridFs.writeData(serializer(document), '/maintenance.html', 'text/html', {
      status : 200
    }, callback);

  } catch (error) {
    callback(error);
  }
};