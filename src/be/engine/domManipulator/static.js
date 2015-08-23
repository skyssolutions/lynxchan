'use strict';

var jsdom = require('jsdom').jsdom;
var serializer = require('jsdom').serializeDocument;
var gridFs = require('../gridFsHandler');
var templateHandler = require('../templateHandler');
var lang = require('../langOps').languagePack();
var boot = require('../../boot');
var settings = boot.getGeneralSettings();
var common = require('./common');
var archive = settings.archiveLevel > 0 && require('../../archive').loaded();

var accountCreationDisabled = settings.disableAccountCreation;
var siteTitle = settings.siteTitle || lang.titDefaultChanTitle;

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

exports.frontPage = function(boards, callback) {

  try {

    var document = jsdom(templateHandler.index);

    document.title = siteTitle;

    var boardsDiv = document.getElementById('divBoards');

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

    gridFs.writeData(serializer(document), '/', 'text/html', {}, callback);
  } catch (error) {
    callback(error);
  }
};

// Section 1: Thread {
function setThreadHiddenIdentifiers(document, boardUri, threadData) {
  var boardIdentifyInput = document.getElementById('boardIdentifier');

  boardIdentifyInput.setAttribute('value', boardUri);

  var threadIdentifyInput = document.getElementById('threadIdentifier');

  threadIdentifyInput.setAttribute('value', threadData.threadId);
}

function setModdingInformation(document, boardUri, boardData, threadData,
    posts, callback) {

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

}

function hideModElements(document) {

  common.removeElement(document.getElementById('inputBan'));
  common.removeElement(document.getElementById('divBanInput'));
  common.removeElement(document.getElementById('divControls'));

}

function setThreadTitle(document, boardUri, threadData) {
  var title = '/' + boardUri + '/ - ';

  if (threadData.subject) {
    title += threadData.subject;
  } else {
    title += threadData.message.substring(0, 256);
  }

  document.title = title;
}

function setModElements(modding, document, boardUri, boardData, threadData,
    posts, callback) {

  if (modding) {

    setModdingInformation(document, boardUri, boardData, threadData, posts,
        callback);

  } else {
    hideModElements(document);
    var ownName = 'res/' + threadData.threadId + '.html';

    gridFs.writeData(serializer(document), '/' + boardUri + '/' + ownName,
        'text/html', {
          boardUri : boardUri,
          type : 'thread',
          threadId : threadData.threadId
        }, callback, archive && boardData.settings.indexOf('archive') > -1);
  }
}

exports.thread = function(boardUri, boardData, flagData, threadData, posts,
    callback, modding) {

  try {
    var document = jsdom(templateHandler.threadPage);

    setThreadTitle(document, boardUri, threadData);

    var linkModeration = '/mod.js?boardUri=' + boardData.boardUri;
    linkModeration += '&threadId=' + threadData.threadId;

    var moderationElement = document.getElementById('linkMod');
    moderationElement.href = linkModeration;

    var linkManagement = document.getElementById('linkManagement');
    linkManagement.href = '/boardManagement.js?boardUri=' + boardData.boardUri;

    common.setHeader(document, boardUri, boardData, flagData);

    setThreadHiddenIdentifiers(document, boardUri, threadData);

    common.addThread(document, threadData, posts, boardUri, true, modding,
        boardData);

    setModElements(modding, document, boardUri, boardData, threadData, posts,
        callback);

  } catch (error) {
    callback(error);
  }

};
// } Section 1: Thread

// Section 2: Board {
function generateThreadListing(document, boardUri, page, threads, latestPosts,
    callback) {

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
}

function addPagesLinks(document, pageCount, currentPage) {

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
}

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

    addPagesLinks(document, pageCount, page);

    generateThreadListing(document, board, page, threads, latestPosts, cb);
  } catch (error) {
    cb(error);
  }
};
// } Section 2: Board

// Section 3: Catalog {

function setCellThumb(thumbLink, boardUri, document, thread) {
  thumbLink.href = '/' + boardUri + '/res/' + thread.threadId + '.html';

  if (thread.files && thread.files.length) {
    var thumbImage = document.createElement('img');

    thumbImage.src = thread.files[0].thumb;
    thumbLink.appendChild(thumbImage);
  } else {
    thumbLink.innerHTML = lang.guiOpen;
  }
}

function setCell(boardUri, document, cell, thread) {

  setCellThumb(cell.getElementsByClassName('linkThumb')[0], boardUri, document,
      thread);

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

}

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

      setCell(boardUri, document, cell, thread);

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

exports.preview = function(postingData, callback) {
  try {

    var document = jsdom(templateHandler.previewPage);

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
      postingData.postId = postingData.threadId;
      path += postingData.threadId;
    }

    path += '.html';

    var innerCell = document.createElement('div');
    innerCell.innerHTML = templateHandler.postCell;

    common.setPostInnerElements(document, postingData.boardUri,
        postingData.threadId, postingData, innerCell, true);

    document.getElementById('panelContent').appendChild(innerCell);

    gridFs.writeData(serializer(document), path, 'text/html', metadata,
        callback);

  } catch (error) {
    callback(error);
  }
};

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