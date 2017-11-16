'use strict';

// handles static pages. Note: thread pages can also be output as a dynamic
// page by form/mod.js

var kernel = require('../../kernel');
var individualCaches = !kernel.debug();
individualCaches = individualCaches && !kernel.feDebug();
var JSDOM = require('jsdom').JSDOM;
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

var availableLogTypes = {
  ban : 'guiTypeBan',
  banLift : 'guiTypeBanLift',
  deletion : 'guiTypeDeletion',
  fileDeletion : 'guiTypeFileDeletion',
  reportClosure : 'guiTypeReportClosure',
  globalRoleChange : 'guiTypeGlobalRoleChange',
  boardDeletion : 'guiTypeBoardDeletion',
  boardTransfer : 'guiTypeBoardTransfer',
  hashBan : 'guiTypeHashBan',
  hashBanLift : 'guiTypeHashBanLift',
  threadTransfer : 'guiTypeThreadTransfer',
  appealDeny : 'guiTypeAppealDeny'
};

exports.loadSettings = function() {
  var settings = require('../../settingsHandler').getGeneralSettings();

  disableCatalogPosting = settings.disableCatalogPosting;
  sfwOverboard = settings.sfwOverboard;
  overboard = settings.overboard;
  accountCreationDisabled = settings.disableAccountCreation;
  siteTitle = settings.siteTitle;
  clearIpMinRole = settings.clearIpMinRole;

};

exports.loadDependencies = function() {

  miscOps = require('../miscOps');
  engineInfo = require('../addonOps').getEngineInfo();
  common = require('.').common;
  templateHandler = require('../templateHandler').getTemplates;
  lang = require('../langOps').languagePack;
  gridFs = require('../gridFsHandler');

};

exports.notFound = function(language, callback) {

  try {
    var dom = new JSDOM(templateHandler(language).notFoundPage);
    var document = dom.window.document;

    document.title = lang(language).titNotFound;

    var path = '/404.html';
    var meta = {
      status : 404
    };

    if (language) {
      meta.referenceFile = path;
      meta.languages = language.headerValues;
      path += language.headerValues.join('-');
    }

    gridFs.writeData(dom.serialize(), path, 'text/html', meta, callback);
  } catch (error) {
    callback(error);
  }

};

exports.login = function(language, callback) {

  try {
    var dom = new JSDOM(templateHandler(language).loginPage);
    var document = dom.window.document;

    document.title = lang(language).titLogin;

    if (accountCreationDisabled) {
      document.getElementById('divCreation').remove();
    }

    var path = '/login.html';
    var meta = {};

    if (language) {
      meta.referenceFile = path;
      meta.languages = language.headerValues;
      path += language.headerValues.join('-');
    }

    gridFs.writeData(dom.serialize(), path, 'text/html', meta, callback);

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
    threadData, posts, userRole, language) {

  var globalStaff = userRole <= miscOps.getMaxStaffRole();
  if (!globalStaff || !modding) {
    document.getElementById('formTransfer').remove();
  }

  var allowedToDeleteFromIp = userRole <= clearIpMinRole;

  if (!modding || !allowedToDeleteFromIp) {
    document.getElementById('ipDeletionForm').remove();
  }

};

exports.setThreadCommonInfo = function(document, boardUri, threadData,
    boardData, language, flagData, posts, modding, userRole) {

  exports.setThreadTitle(document, boardUri, threadData);

  var linkModeration = '/mod.js?boardUri=' + boardData.boardUri;
  linkModeration += '&threadId=' + threadData.threadId;

  var moderationElement = document.getElementById('linkMod');
  moderationElement.href = linkModeration;

  var linkManagement = document.getElementById('linkManagement');
  linkManagement.href = '/boardManagement.js?boardUri=' + boardData.boardUri;

  common.setHeader(document, boardUri, boardData, flagData, true, language);

  exports.setThreadHiddenIdentifiers(document, boardUri, threadData);

  common.addThread(document, threadData, posts, true, modding, boardData,
      userRole, language);

  exports.setModElements(modding, document, boardUri, boardData, threadData,
      posts, userRole, language);

};

exports.getThreadPathAndMeta = function(boardUri, language, meta, threadData) {

  var path = '/' + boardUri + '/res/' + threadData.threadId + '.html';

  if (language) {
    meta.languages = language.headerValues;
    meta.referenceFile = path;
    path += language.headerValues.join('-');
  }

  return path;

};

exports.thread = function(boardUri, boardData, flagData, threadData, posts,
    callback, modding, userRole, language) {

  try {
    var dom = new JSDOM(templateHandler(language).threadPage);
    var document = dom.window.document;

    exports.setThreadCommonInfo(document, boardUri, threadData, boardData,
        language, flagData, posts, modding, userRole);

    if (modding) {
      exports.setModdingInformation(document, boardUri, threadData, callback);

      callback(null, dom.serialize());

    } else {

      document.getElementById('divMod').remove();
      document.getElementById('divControls').remove();

      var meta = {
        boardUri : boardUri,
        type : 'thread',
        threadId : threadData.threadId
      };

      var path = exports.getThreadPathAndMeta(boardUri, language, meta,
          threadData);

      gridFs.writeData(dom.serialize(), path, 'text/html', meta, callback);
    }

  } catch (error) {
    callback(error);
  }

};
// } Section 1: Thread

// Section 2: Board {
exports.generateThreadListing = function(document, threads, latestPosts,
    language) {

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

};

exports.addPagesLinks = function(document, pageCount, currentPage) {

  var previous = document.getElementById('linkPrevious');
  if (currentPage === 1) {
    previous.remove();
  } else {
    previous.href = currentPage > 2 ? currentPage - 1 + '.html' : 'index.html';
  }

  var next = document.getElementById('linkNext');
  if (pageCount === currentPage) {
    next.remove();
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

exports.getPagePathAndMeta = function(board, page, meta, language) {

  var path = '/' + board + '/' + (page === 1 ? '' : page + '.html');

  if (language) {
    meta.languages = language.headerValues;
    meta.referenceFile = path;
    path += language.headerValues.join('-');
  }

  return path;

};

exports.page = function(board, page, threads, pageCount, boardData, flagData,
    latestPosts, language, cb) {

  try {

    var dom = new JSDOM(templateHandler(language).boardPage);
    var document = dom.window.document;

    document.title = '/' + board + '/' + ' - ' + boardData.boardName;

    var linkManagement = document.getElementById('linkManagement');
    linkManagement.href = '/boardManagement.js?boardUri=' + board;

    var linkModeration = document.getElementById('linkModeration');
    linkModeration.href = '/boardModeration.js?boardUri=' + board;

    common.setHeader(document, board, boardData, flagData, null, language);

    exports.addPagesLinks(document, pageCount, page);

    exports.generateThreadListing(document, threads, latestPosts, language);

    var meta = {
      boardUri : board,
      type : 'board'
    };

    var path = exports.getPagePathAndMeta(board, page, meta, language);

    gridFs.writeData(dom.serialize(), path, 'text/html', meta, cb);

  } catch (error) {
    cb(error);
  }
};
// } Section 2: Board

// Section 3: Catalog {
exports.setCellThumb = function(thumbLink, boardUri, doc, thread, language) {
  thumbLink.href = '/' + boardUri + '/res/' + thread.threadId + '.html';

  if (thread.files && thread.files.length) {
    var thumbImage = doc.createElement('img');

    thumbImage.src = thread.files[0].thumb;
    thumbLink.appendChild(thumbImage);
  } else {
    thumbLink.innerHTML = lang(language).guiOpen;
  }
};

exports.setCatalogCellIndicators = function(thread, cell) {

  for ( var key in common.indicatorsRelation) {
    if (!thread[key]) {
      cell.getElementsByClassName(common.indicatorsRelation[key])[0].remove();
    }
  }

};

exports.setCell = function(boardUri, document, thread, language) {

  var cell = document.createElement('div');

  cell.innerHTML = templateHandler(language).catalogCell;
  cell.setAttribute('class', 'catalogCell');

  exports.setCellThumb(cell.getElementsByClassName('linkThumb')[0], boardUri,
      document, thread, language);

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

exports.setCatalogPosting = function(boardData, boardUri, flagData, document,
    language) {

  if (!disableCatalogPosting) {

    common.setBoardPosting(boardData, document, null, language);
    common.setFlags(document, boardUri, flagData, language);
  } else {
    document.getElementById('postingForm').remove();
  }

};

exports.setCatalogElements = function(boardData, document, language, threads,
    flagData) {

  var boardUri = boardData.boardUri;

  if (boardData.usesCustomCss) {
    common.setCustomCss(boardUri, document);
  }

  document.title = lang(language).titCatalog.replace('{$board}', boardUri);

  document.getElementById('labelBoard').innerHTML = '/' + boardUri + '/';

  exports.setCatalogPosting(boardData, boardUri, flagData, document, language);

  var threadsDiv = document.getElementById('divThreads');

  for (var i = 0; i < threads.length; i++) {
    threadsDiv.appendChild(exports.setCell(boardUri, document, threads[i],
        language));
  }

};

exports.catalog = function(language, boardData, threads, flagData, callback) {

  try {

    var dom = new JSDOM(templateHandler(language).catalogPage);
    var document = dom.window.document;

    exports
        .setCatalogElements(boardData, document, language, threads, flagData);

    var meta = {
      boardUri : boardData.boardUri,
      type : 'catalog'
    };
    var path = '/' + boardData.boardUri + '/catalog.html';

    if (language) {
      meta.languges = language.headerValues;
      meta.referenceFile = path;
      path += language.headerValues.join('-');
    }

    gridFs.writeData(dom.serialize(), path, 'text/html', meta, callback);

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
    boardsDiv.remove();
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
    latestPostsDiv.remove();
  } else {
    exports.setLatestPosts(latestPosts, latestPostsDiv, document, language);
  }

  var latestImagesDiv = document.getElementById('divLatestImages');

  if (!latestImages) {
    latestImagesDiv.remove();
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

  document.title = siteTitle || lang(language).titDefaultChanTitle;

  exports.setTopBoards(document, boards, language);

  if (globalStats) {
    exports.setGlobalStats(document, globalStats);
  } else {
    document.getElementById('divStats').remove();
  }

  exports.checkForLatestContent(document, latestImages, latestPosts, language);

  exports.setEngineInfo(document);

};

exports.frontPage = function(boards, latestPosts, latestImages, globalStats,
    language, callback) {

  try {

    var dom = new JSDOM(templateHandler(language).index);
    var document = dom.window.document;

    exports.setFrontPageContent(document, boards, globalStats, latestImages,
        latestPosts, language);

    var filePath = '/';
    var meta = {
      type : 'frontPage'
    };

    if (language) {
      meta.referenceFile = filePath;
      meta.languages = language.headerValues;
      filePath += language.headerValues.join('-');
    }

    gridFs.writeData(dom.serialize(), filePath, 'text/html', meta, callback);

  } catch (error) {
    callback(error);
  }

};
// } Section 4: Front page

exports.maintenance = function(language, callback) {
  try {

    var dom = new JSDOM(templateHandler(language).maintenancePage);
    var document = dom.window.document;

    document.title = lang(language).titMaintenance;

    var path = '/maintenance.html';
    var meta = {
      status : 200
    };

    if (language) {
      meta.referenceFile = path;
      meta.languages = language.headerValues;
      path += language.headerValues.join('-');
    }

    gridFs.writeData(dom.serialize(), path, 'text/html', meta, callback);

  } catch (error) {
    callback(error);
  }
};

// Section 5: Overboard {
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

exports.getOverboardPathAndMeta = function(language, doc, meta, sfw) {

  doc.title = '/' + (sfw ? sfwOverboard : overboard) + '/';

  var path = doc.title;

  if (language) {
    meta.referenceFile = path;
    meta.languages = language.headerValues;
    path += language.headerValues.join('-');
  }

  return path;

};

exports.overboard = function(foundThreads, previewRelation, callback,
    multiBoard, sfw, language) {

  try {

    var dom = new JSDOM(templateHandler(language).overboard);
    var document = dom.window.document;

    exports.addOverBoardThreads(foundThreads, previewRelation, document,
        language);

    if (multiBoard) {
      document.title = lang(language).titMultiboard;
      callback(null, dom.serialize());
    } else {

      var meta = {
        type : 'overboard'
      };

      var path = exports.getOverboardPathAndMeta(language, document, meta, sfw);

      gridFs.writeData(dom.serialize(), path, 'text/html', meta, callback);

    }

  } catch (error) {
    callback(error);
  }
};
// } Section 5: Overboard

// Section 6: Log page {
exports.setLogEntry = function(logCell, log, language) {

  if (!log.global) {
    logCell.getElementsByClassName('indicatorGlobal')[0].remove();
  }

  var labelType = logCell.getElementsByClassName('labelType')[0];
  labelType.innerHTML = lang(language)[availableLogTypes[log.type]];

  var labelTime = logCell.getElementsByClassName('labelTime')[0];
  labelTime.innerHTML = common.formatDateToDisplay(log.time, null, language);

  var labelBoard = logCell.getElementsByClassName('labelBoard')[0];
  labelBoard.innerHTML = log.boardUri || '';

  var labelUser = logCell.getElementsByClassName('labelUser')[0];
  labelUser.innerHTML = log.user;

  var labelDescription = logCell.getElementsByClassName('labelDescription')[0];
  labelDescription.innerHTML = log.description;

};

exports.getLogEntryCacheObject = function(innerHTML, language) {

  if (!language) {
    return {
      cache : innerHTML
    };
  }

  var toReturn = {};
  var key = 'alternativeCaches.' + language.headerValues.join('-');
  toReturn[key] = innerHTML;

  return toReturn;
};

exports.getLogEntryCache = function(logEntry, language) {

  if (!language) {
    return logEntry.cache;
  }

  return (logEntry.alternativeCaches || {})[language.headerValues.join('-')];

};

exports.addLogEntry = function(logEntry, document, language) {

  var logCell = document.createElement('div');
  logCell.setAttribute('class', 'logCell');

  var existingCache = exports.getLogEntryCache(logEntry, language);

  if (!existingCache || !individualCaches) {

    logCell.innerHTML = templateHandler(language).logCell;

    exports.setLogEntry(logCell, logEntry, language);

    if (individualCaches) {

      staffLogs.updateOne({
        _id : logEntry._id
      }, {
        $set : exports.getLogEntryCacheObject(logCell.innerHTML, language)
      });
    }

  } else {
    logCell.innerHTML = existingCache;
  }

  document.getElementById('divLogs').appendChild(logCell);

};

exports.log = function(language, date, logs, callback) {

  try {

    var dom = new JSDOM(templateHandler(language).logsPage);
    var document = dom.window.document;

    document.title = lang(language).titLogPage.replace('{$date}', common
        .formatDateToDisplay(date, true, language));

    for (var i = 0; i < logs.length; i++) {
      exports.addLogEntry(logs[i], document, language);
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

    gridFs.writeData(dom.serialize(), path, 'text/html', meta, callback);

  } catch (error) {
    callback(error);
  }

};
// Section 6: Log page {

// Section 7: Rules {
exports.getRulesDocument = function(language, boardUri, rules) {

  var dom = new JSDOM(templateHandler(language).rulesPage);
  var document = dom.window.document;

  document.title = lang(language).titRules.replace('{$board}', boardUri);
  document.getElementById('boardLabel').innerHTML = boardUri;
  var rulesDiv = document.getElementById('divRules');

  for (var i = 0; i < rules.length; i++) {
    var cell = document.createElement('div');
    cell.innerHTML = templateHandler(language).ruleCell;
    cell.setAttribute('class', 'ruleCell');

    cell.getElementsByClassName('textLabel')[0].innerHTML = rules[i];
    cell.getElementsByClassName('indexLabel')[0].innerHTML = i + 1;

    rulesDiv.appendChild(cell);
  }

  return dom.serialize();

};

exports.rules = function(language, boardUri, rules, callback) {
  try {

    var path = '/' + boardUri + '/rules.html';
    var meta = {
      boardUri : boardUri,
      type : 'rules'
    };

    if (language) {
      meta.referenceFile = path;
      meta.languages = language.headerValues;
      path += language.headerValues.join('-');
    }

    gridFs.writeData(exports.getRulesDocument(language, boardUri, rules), path,
        'text/html', meta, callback);

  } catch (error) {
    callback(error);
  }
};
// } Section 7: Rules
