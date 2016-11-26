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
var threadsCollection = db.threads();
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
  templateHandler = require('../templateHandler').getTemplates;
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

exports.notFound = function(language, callback) {

  try {
    var document = jsdom(templateHandler(language).notFoundPage);

    document.title = lang.titNotFound;

    var path = '/404.html';
    var meta = {
      status : 404
    };

    if (language) {
      meta.referenceFile = path;
      meta.languages = language.headerValues;
      path += language.headerValues.join('-');
    }

    gridFs.writeData(serializer(document), path, 'text/html', meta, callback);
  } catch (error) {
    callback(error);
  }

};

exports.login = function(language, callback) {

  try {
    var document = jsdom(templateHandler(language).loginPage);

    document.title = lang.titLogin;

    if (accountCreationDisabled) {
      common.removeElement(document.getElementById('divCreation'));
    }

    var path = '/login.html';
    var meta = {};

    if (language) {
      meta.referenceFile = path;
      meta.languages = language.headerValues;
      path += language.headerValues.join('-');
    }

    gridFs.writeData(serializer(document), path, 'text/html', meta, callback);

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

exports.setModdingInformation = function(document, boardUri, threadData,
    callback) {

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

exports.setThreadTitle = function(document, boardUri, threadData) {
  var title = '/' + boardUri + '/ - ';

  if (threadData.subject) {
    title += threadData.subject;
  } else {
    title += threadData.message.substring(0, 256);
  }

  document.title = title;
};

exports.saveRegularThreadPage = function(document, boardUri, threadData,
    callback, language) {

  common.removeElement(document.getElementById('divMod'));
  common.removeElement(document.getElementById('divControls'));

  var path = '/' + boardUri + '/res/' + threadData.threadId + '.html';

  var meta = {
    boardUri : boardUri,
    type : 'thread',
    threadId : threadData.threadId
  };

  if (language) {
    meta.languages = language.headerValues;
    meta.referenceFile = path;
    path += language.headerValues.join('-');
  }

  gridFs.writeData(serializer(document), path, 'text/html', meta, callback);

};

exports.setModElements = function(modding, document, boardUri, boardData,
    threadData, posts, userRole, callback, language) {

  var globalStaff = userRole <= miscOps.getMaxStaffRole();
  if (!globalStaff || !modding) {
    common.removeElement(document.getElementById('formTransfer'));
  }

  var allowedToDeleteFromIp = userRole <= clearIpMinRole;

  if (!modding || !allowedToDeleteFromIp) {
    common.removeElement(document.getElementById('ipDeletionForm'));
  }

  if (modding) {
    exports.setModdingInformation(document, boardUri, threadData, callback);
  } else {
    exports.saveRegularThreadPage(document, boardUri, threadData, callback,
        language);
  }
};

exports.thread = function(boardUri, boardData, flagData, threadData, posts,
    callback, modding, userRole, language) {

  try {
    var document = jsdom(templateHandler(language).threadPage);

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
        userRole, language);

    exports.setModElements(modding, document, boardUri, boardData, threadData,
        posts, userRole, callback, language);

  } catch (error) {
    callback(error);
  }

};
// } Section 1: Thread

// Section 2: Board {
exports.generateThreadListing = function(document, boardUri, page, threads,
    latestPosts, language, callback) {

  var tempLatest = {};

  for (var i = 0; i < latestPosts.length; i++) {

    tempLatest[latestPosts[i]._id] = latestPosts[i].latestPosts;
  }

  latestPosts = tempLatest;

  for (i = 0; i < threads.length; i++) {
    var thread = threads[i];

    common.addThread(document, thread, latestPosts[thread.threadId], null,
        null, null, null, language);

  }

  var path = '/' + boardUri + '/' + (page === 1 ? '' : page + '.html');
  var meta = {
    boardUri : boardUri,
    type : 'board'
  };

  if (language) {
    meta.languages = language.headerValues;
    meta.referenceFile = path;
    path += language.headerValues.join('-');
  }

  gridFs.writeData(serializer(document), path, 'text/html', meta, callback);
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
    latestPosts, language, cb) {

  try {

    var document = jsdom(templateHandler(language).boardPage);

    document.title = '/' + board + '/' + ' - ' + boardData.boardName;

    var linkManagement = document.getElementById('linkManagement');
    linkManagement.href = '/boardManagement.js?boardUri=' + board;

    var linkModeration = document.getElementById('linkModeration');
    linkModeration.href = '/boardModeration.js?boardUri=' + board;

    common.setHeader(document, board, boardData, flagData);

    exports.addPagesLinks(document, pageCount, page);

    exports.generateThreadListing(document, board, page, threads, latestPosts,
        language, cb);
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

exports.setCell = function(boardUri, document, thread, language) {

  var cell = document.createElement('div');

  cell.innerHTML = templateHandler(language).catalogCell;
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

exports.storeCatalogPage = function(document, boardUri, language, callback) {

  var meta = {
    boardUri : boardUri,
    type : 'catalog'
  };
  var path = '/' + boardUri + '/catalog.html';

  if (language) {
    meta.languges = language.headerValues;
    meta.referenceFile = path;
    path += language.headerValues.join('-');
  }

  gridFs.writeData(serializer(document), path, 'text/html', meta, callback);

};

exports.catalog = function(language, boardData, threads, flagData, callback) {

  try {

    var document = jsdom(templateHandler(language).catalogPage);

    var boardUri = boardData.boardUri;

    if (boardData.usesCustomCss) {
      common.setCustomCss(boardUri, document);
    }

    document.title = lang.titCatalog.replace('{$board}', boardUri);

    document.getElementById('labelBoard').innerHTML = '/' + boardUri + '/';

    exports.setCatalogPosting(boardData, boardUri, flagData, document);

    var threadsDiv = document.getElementById('divThreads');

    for (var i = 0; i < threads.length; i++) {
      threadsDiv.appendChild(exports.setCell(boardUri, document, threads[i],
          language));
    }

    exports.storeCatalogPage(document, boardUri, language, callback);

  } catch (error) {
    callback(error);
  }

};
// } Section 3: Catalog

// Section 4: Front page {
exports.setLatestImages = function(latestImages, latestImagesDiv, document,
    language) {

  for (var i = 0; i < latestImages.length; i++) {

    var image = latestImages[i];

    var cell = document.createElement('div');
    cell.innerHTML = templateHandler(language).latestImageCell;
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

exports.setTopBoards = function(document, boards, language) {

  var boardsDiv = document.getElementById('divBoards');

  if (!boards) {
    common.removeElement(boardsDiv);
    return;
  }

  for (var i = 0; i < boards.length; i++) {

    var board = boards[i];

    var cell = document.createElement('div');
    cell.innerHTML = templateHandler(language).topBoardCell;

    var link = cell.getElementsByClassName('boardLink')[0];

    link.href = '/' + board.boardUri + '/';
    link.innerHTML = '/' + board.boardUri + '/ - ' + board.boardName;

    boardsDiv.appendChild(cell);

  }

};

exports.setLatestPosts = function(latestPosts, latestPostsDiv, document,
    language) {

  for (var i = 0; i < latestPosts.length; i++) {
    var post = latestPosts[i];

    var cell = document.createElement('div');
    cell.innerHTML = templateHandler(language).latestPostCell;
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

exports.checkForLatestContent = function(document, latestImages, latestPosts,
    language) {

  var latestPostsDiv = document.getElementById('divLatestPosts');

  if (!latestPosts) {
    common.removeElement(latestPostsDiv);
  } else {
    exports.setLatestPosts(latestPosts, latestPostsDiv, document, language);
  }

  var latestImagesDiv = document.getElementById('divLatestImages');

  if (!latestImages) {
    common.removeElement(latestImagesDiv);
  } else {
    exports.setLatestImages(latestImages, latestImagesDiv, document, language);
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

exports.setFrontPageContent = function(document, boards, globalStats,
    latestImages, latestPosts, language) {

  document.title = siteTitle;

  exports.setTopBoards(document, boards, language);

  if (globalStats) {
    exports.setGlobalStats(document, globalStats);
  } else {
    common.removeElement(document.getElementById('divStats'));
  }

  exports.checkForLatestContent(document, latestImages, latestPosts, language);

  exports.setEngineInfo(document);

};

exports.frontPage = function(boards, latestPosts, latestImages, globalStats,
    language, callback) {

  try {

    var document = jsdom(templateHandler(language).index);

    exports.setFrontPageContent(document, boards, globalStats, latestImages,
        latestPosts, language);

    var filePath = '/';
    var meta = {};

    if (language) {
      meta.referenceFile = filePath;
      meta.languages = language.headerValues;
      filePath += language.headerValues.join('-');
    }

    gridFs.writeData(serializer(document), filePath, 'text/html', meta,
        callback);

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

    var path = '/' + postingData.boardUri + '/preview/';

    var metadata = {
      boardUri : postingData.boardUri,
      threadId : postingData.threadId,
      type : 'preview'
    };

    path = exports.setMetadata(metadata, postingData, path);

    path += '.html';

    var document = jsdom(templateHandler().previewPage);

    var innerCell = document.createElement('div');
    innerCell.setAttribute('class', 'postCell');

    common.setPostInnerElements(document, postingData, innerCell, true);

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

    var document = jsdom(templateHandler().rulesPage);

    document.title = lang.titRules.replace('{$board}', boardUri);
    document.getElementById('boardLabel').innerHTML = boardUri;
    var rulesDiv = document.getElementById('divRules');

    for (var i = 0; i < rules.length; i++) {
      var cell = document.createElement('div');
      cell.innerHTML = templateHandler().ruleCell;
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

exports.maintenance = function(language, callback) {
  try {

    var document = jsdom(templateHandler(language).maintenancePage);

    document.title = lang.titMaintenance;

    var path = '/maintenance.html';
    var meta = {
      status : 200
    };

    if (language) {
      meta.referenceFile = path;
      meta.languages = language.headerValues;
      path += language.headerValues.join('-');
    }

    gridFs.writeData(serializer(document), path, 'text/html', meta, callback);

  } catch (error) {
    callback(error);
  }
};

// Section 6: Overboard {
exports.addOverBoardThreads = function(foundThreads, previewRelation, doc,
    language) {

  for (var i = 0; i < foundThreads.length; i++) {
    var thread = foundThreads[i];

    var previews = [];

    if (previewRelation[thread.boardUri]) {

      previews = previewRelation[thread.boardUri][thread.threadId];
    }

    common.addThread(doc, thread, previews, null, null, null, null, language);
  }

};

exports.overboard = function(foundThreads, previewRelation, callback,
    multiBoard, sfw, language) {

  try {

    var document = jsdom(templateHandler(language).overboard);

    exports.addOverBoardThreads(foundThreads, previewRelation, document,
        language);

    if (multiBoard) {
      document.title = lang.titMultiboard;
      callback(null, serializer(document));
    } else {
      document.title = '/' + (sfw ? sfwOverboard : overboard) + '/';

      var path = document.title;
      var meta = {};

      if (language) {
        meta.referenceFile = path;
        meta.languages = language.headerValues;
        path += language.headerValues.join('-');
      }

      gridFs.writeData(serializer(document), path, 'text/html', meta, callback);
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

exports.addLogEntry = function(logEntry, document, div, language) {

  var logCell = document.createElement('div');
  logCell.setAttribute('class', 'logCell');

  if (!logEntry.cache || !individualCaches) {

    logCell.innerHTML = templateHandler(language).logCell;

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

exports.log = function(language, date, logs, callback) {

  try {

    var document = jsdom(templateHandler(language).logsPage);

    document.title = lang.titLogPage.replace('{$date}', common
        .formatDateToDisplay(date, true));

    var div = document.getElementById('divLogs');

    for (var i = 0; i < logs.length; i++) {
      exports.addLogEntry(logs[i], document, div, language);
    }

    var path = '/.global/logs/';
    path += logger.formatedDate(date) + '.html';

    var meta = {
      type : 'log'
    };

    if (language) {
      meta.languages = language.headerValues;
      meta.referenceFile = path;
      path += language.headerValues.join('-');
    }

    gridFs.writeData(serializer(document), path, 'text/html', meta, callback);

  } catch (error) {
    callback(error);
  }

};
// Section 7: Log page {
