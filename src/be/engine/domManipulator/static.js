'use strict';

// handles static pages. Note: thread pages can also be output as a dynamic
// page by form/mod.js

var kernel = require('../../kernel');
var individualCaches = !kernel.debug();
individualCaches = individualCaches && !kernel.feDebug();
var jsdom = require('jsdom').jsdom;
var serializer = require('jsdom').serializeDocument;
var logger = require('../../logger');
var db = require('../../db');
var postsCollection = db.posts();
var staffLogs = db.logs();
var accountCreationDisabled;
var common;
var templateHandler;
var lang;
var gridFs;
var miscOps;
var clearIpMinRole;
var overboard;
var sfwOverboard;
var siteTitle;
var engineInfo;
var disableCatalogPosting;

var availableLogTypes;

exports.loadSettings = function() {
  var settings = require('../../settingsHandler').getGeneralSettings();

  disableCatalogPosting = settings.disableCatalogPosting;
  sfwOverboard = settings.sfwOverboard;
  overboard = settings.overboard;
  accountCreationDisabled = settings.disableAccountCreation;
  siteTitle = settings.siteTitle || lang.titDefaultChanTitle;
  clearIpMinRole = settings.clearIpMinRole;

};

exports.loadDependencies = function() {

  miscOps = require('../miscOps');
  engineInfo = require('../addonOps').getEngineInfo();
  common = require('.').common;
  templateHandler = require('../templateHandler');
  lang = require('../langOps').languagePack();
  gridFs = require('../gridFsHandler');
  availableLogTypes = {
    ban : lang.guiTypeBan,
    banLift : lang.guiTypeBanLift,
    deletion : lang.guiTypeDeletion,
    fileDeletion : lang.guiTypeFileDeletion,
    reportClosure : lang.guiTypeReportClosure,
    globalRoleChange : lang.guiTypeGlobalRoleChange,
    boardDeletion : lang.guiTypeBoardDeletion,
    boardTransfer : lang.guiTypeBoardTransfer,
    hashBan : lang.guiTypeHashBan,
    hashBanLift : lang.guiTypeHashBanLift,
    threadTransfer : lang.guiTypeThreadTransfer,
    appealDeny : lang.guiTypeAppealDeny
  };

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
  var threadIdentifyInput = document.getElementById('threadIdentifier');
  threadIdentifyInput.setAttribute('value', threadData.threadId);

  var threadTransferInput = document.getElementById('transferThreadIdentifier');
  threadTransferInput.setAttribute('value', threadData.threadId);

  var boardTransferInput = document.getElementById('transferBoardIdentifier');
  boardTransferInput.setAttribute('value', boardUri);

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

  common.removeElement(document.getElementById('divMod'));
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
    threadData, posts, userRole, callback) {

  var globalStaff = userRole <= miscOps.getMaxStaffRole();
  if (!globalStaff || !modding) {
    common.removeElement(document.getElementById('formTransfer'));
  }

  var allowedToDeleteFromIp = userRole <= clearIpMinRole;

  if (!modding || !allowedToDeleteFromIp) {
    common.removeElement(document.getElementById('ipDeletionForm'));
  }

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
        }, callback);
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

    common.setHeader(document, boardUri, boardData, flagData, true);

    exports.setThreadHiddenIdentifiers(document, boardUri, threadData);

    common.addThread(document, threadData, posts, true, modding, boardData,
        userRole);

    exports.setModElements(modding, document, boardUri, boardData, threadData,
        posts, userRole, callback);

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

    common.addThread(document, thread, latestPosts[thread.threadId]);

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

exports.setCatalogCellIndicators = function(thread, cell) {

  for ( var key in common.indicatorsRelation) {
    if (!thread[key]) {

      common.removeElement(cell
          .getElementsByClassName(common.indicatorsRelation[key])[0]);
    }
  }

};

exports.setCell = function(boardUri, document, thread) {

  var cell = document.createElement('div');

  cell.innerHTML = templateHandler.catalogCell;
  cell.setAttribute('class', 'catalogCell');

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

  exports.setCatalogCellIndicators(thread, cell);

  cell.getElementsByClassName('divMessage')[0].innerHTML = thread.markdown;

  return cell;

};

exports.setCatalogPosting = function(boardData, boardUri, flagData, document) {

  if (!disableCatalogPosting) {

    common.setBoardPosting(boardData, document);
    common.setFlags(document, boardUri, flagData);
  } else {
    common.removeElement(document.getElementById('postingForm'));
  }

};

exports.catalog = function(boardData, threads, flagData, callback) {

  try {

    var document = jsdom(templateHandler.catalogPage);

    var boardUri = boardData.boardUri;

    if (boardData.usesCustomCss) {
      common.setCustomCss(boardUri, document);
    }

    document.title = lang.titCatalog.replace('{$board}', boardUri);

    document.getElementById('labelBoard').innerHTML = '/' + boardUri + '/';

    exports.setCatalogPosting(boardData, boardUri, flagData, document);

    var threadsDiv = document.getElementById('divThreads');

    for (var i = 0; i < threads.length; i++) {
      threadsDiv.appendChild(exports.setCell(boardUri, document, threads[i]));
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
exports.setLatestImages = function(latestImages, latestImagesDiv, document) {

  for (var i = 0; i < latestImages.length; i++) {

    var image = latestImages[i];

    var cell = document.createElement('div');
    cell.innerHTML = templateHandler.latestImageCell;
    cell.setAttribute('class', 'latestImageCell');

    var link = cell.getElementsByClassName('linkPost')[0];

    var postLink = '/' + image.boardUri + '/res/' + image.threadId + '.html';
    postLink += '#' + (image.postId || image.threadId);

    link.href = postLink;

    var imgElement = document.createElement('img');
    imgElement.src = image.thumb;

    link.appendChild(imgElement);

    latestImagesDiv.appendChild(cell);

  }

};

exports.setTopBoards = function(document, boards) {

  var boardsDiv = document.getElementById('divBoards');

  if (!boards) {
    common.removeElement(boardsDiv);
    return;
  }

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

exports.setLatestPosts = function(latestPosts, latestPostsDiv, document) {

  for (var i = 0; i < latestPosts.length; i++) {
    var post = latestPosts[i];

    var cell = document.createElement('div');
    cell.innerHTML = templateHandler.latestPostCell;
    cell.setAttribute('class', 'latestPostCell');

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

exports.setEngineInfo = function(document) {

  var link = document.getElementById('linkEngine');

  link.innerHTML = 'LynxChan ' + engineInfo.version;
  link.href = 'http://gitgud.io/LynxChan/LynxChan';

};

exports.checkForLatestContent = function(document, latestImages, latestPosts) {

  var latestPostsDiv = document.getElementById('divLatestPosts');

  if (!latestPosts) {
    common.removeElement(latestPostsDiv);
  } else {
    exports.setLatestPosts(latestPosts, latestPostsDiv, document);
  }

  var latestImagesDiv = document.getElementById('divLatestImages');

  if (!latestImages) {
    common.removeElement(latestImagesDiv);
  } else {
    exports.setLatestImages(latestImages, latestImagesDiv, document);
  }

};

exports.setGlobalStats = function(document, globalStats) {

  var postsLabel = document.getElementById('labelTotalPosts');
  postsLabel.innerHTML = globalStats.totalPosts || 0;

  var ipsLabel = document.getElementById('labelTotalIps');
  ipsLabel.innerHTML = globalStats.totalIps || 0;

  var pphLabel = document.getElementById('labelTotalPPH');
  pphLabel.innerHTML = globalStats.totalPPH || 0;

  var totalBoardsLabel = document.getElementById('labelTotalBoards');
  totalBoardsLabel.innerHTML = globalStats.totalBoards || 0;

  var totalFilesLabel = document.getElementById('labelTotalFiles');
  totalFilesLabel.innerHTML = globalStats.totalFiles || 0;

  var totalSizeLabel = document.getElementById('labelTotalSize');
  totalSizeLabel.innerHTML = globalStats.totalSize || 0;

};

exports.frontPage = function(boards, latestPosts, latestImages, globalStats,
    callback) {

  try {

    var document = jsdom(templateHandler.index);

    document.title = siteTitle;

    exports.setTopBoards(document, boards);

    if (globalStats) {
      exports.setGlobalStats(document, globalStats);
    } else {
      common.removeElement(document.getElementById('divStats'));
    }

    exports.checkForLatestContent(document, latestImages, latestPosts);

    exports.setEngineInfo(document);

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

exports.getPreviewCellDocument = function(postingData) {

  var document = jsdom(templateHandler.previewPage);

  var innerCell = document.createElement('div');
  innerCell.setAttribute('class', 'postCell');

  var cacheField = common.getCacheField();

  // Because of how threads are not displayed the same way on previews,
  // its not possible to either use their cache on previews or
  // to store the generated HTML from here.
  var notUseCache = !individualCaches || !postingData[cacheField];
  notUseCache = notUseCache || postingData.postId === postingData.threadId;

  if (notUseCache) {
    innerCell.innerHTML = templateHandler.postCell;

    common.setPostInnerElements(document, postingData.boardUri,
        postingData.threadId, postingData, innerCell, true);

    if (postingData.postId !== postingData.threadId && individualCaches) {
      common.saveCache(cacheField, innerCell, postsCollection,
          postingData.boardUri, 'postId', postingData.postId);
    }

  } else {
    innerCell.innerHTML = postingData[cacheField];
  }

  document.getElementById('panelContent').appendChild(innerCell);

  return document;

};

exports.preview = function(postingData, callback) {
  try {

    var path = '/' + postingData.boardUri + '/preview/';

    var metadata = {
      boardUri : postingData.boardUri,
      threadId : postingData.threadId,
      type : 'preview'
    };

    path = exports.setMetadata(metadata, postingData, path);

    path += '.html';

    var document = exports.getPreviewCellDocument(postingData);

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
      cell.setAttribute('class', 'ruleCell');

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

// Section 6: Overboard {
exports.addOverBoardThreads = function(foundThreads, previewRelation, doc) {

  for (var i = 0; i < foundThreads.length; i++) {
    var thread = foundThreads[i];

    var previews = [];

    if (previewRelation[thread.boardUri]) {

      previews = previewRelation[thread.boardUri][thread.threadId];
    }

    common.addThread(doc, thread, previews);
  }

};

exports.overboard = function(foundThreads, previewRelation, callback,
    multiBoard, sfw) {

  try {

    var document = jsdom(templateHandler.overboard);

    exports.addOverBoardThreads(foundThreads, previewRelation, document);

    if (multiBoard) {
      document.title = lang.titMultiboard;
      callback(null, serializer(document));
    } else {
      document.title = '/' + (sfw ? sfwOverboard : overboard) + '/';
      gridFs.writeData(serializer(document), document.title, 'text/html', {},
          callback);
    }

  } catch (error) {
    callback(error);
  }
};
// } Section 6: Overboard

// Section 7: Log page {
exports.setLogEntry = function(logCell, log) {

  if (!log.global) {
    common.removeElement(logCell.getElementsByClassName('indicatorGlobal')[0]);
  }

  var labelType = logCell.getElementsByClassName('labelType')[0];
  labelType.innerHTML = availableLogTypes[log.type];

  var labelTime = logCell.getElementsByClassName('labelTime')[0];
  labelTime.innerHTML = common.formatDateToDisplay(log.time);

  var labelBoard = logCell.getElementsByClassName('labelBoard')[0];
  labelBoard.innerHTML = log.boardUri || '';

  var labelUser = logCell.getElementsByClassName('labelUser')[0];
  labelUser.innerHTML = log.user;

  var labelDescription = logCell.getElementsByClassName('labelDescription')[0];
  labelDescription.innerHTML = log.description;

};

exports.addLogEntry = function(logEntry, document, div) {

  var logCell = document.createElement('div');
  logCell.setAttribute('class', 'logCell');

  if (!logEntry.cache || !individualCaches) {

    logCell.innerHTML = templateHandler.logCell;

    exports.setLogEntry(logCell, logEntry);

    if (individualCaches) {
      staffLogs.updateOne({
        _id : logEntry._id
      }, {
        $set : {
          cache : logCell.innerHTML
        }
      });
    }

  } else {
    logCell.innerHTML = logEntry.cache;
  }

  div.appendChild(logCell);

};

exports.log = function(date, logs, callback) {

  try {

    var document = jsdom(templateHandler.logsPage);

    document.title = lang.titLogPage.replace('{$date}', common
        .formatDateToDisplay(date, true));

    var div = document.getElementById('divLogs');

    for (var i = 0; i < logs.length; i++) {
      exports.addLogEntry(logs[i], document, div);
    }

    var path = '/.global/logs/';
    path += logger.formatedDate(date) + '.html';

    gridFs.writeData(serializer(document), path, 'text/html', {
      type : 'log'
    }, callback);

  } catch (error) {
    callback(error);
  }

};
// Section 7: Log page {
