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
exports.setCatalogCellThumb = function(thread, language) {

  var href = '/' + thread.boardUri + '/res/';
  href += thread.threadId + '.html';

  var cell = templateHandler(language, true).catalogCell.template.replace(
      '__linkThumb_href__', href);

  if (thread.files && thread.files.length) {
    var img = '<img src=\"' + thread.files[0].thumb + '\">';
    cell = cell.replace('__linkThumb_inner__', img);
  } else {
    cell = cell.replace('__linkThumb_inner__', lang(language).guiOpen);
  }

  return cell;

};

exports.setCatalogCellIndicators = function(thread, cell, removable) {

  for ( var key in common.indicatorsRelation) {

    var idString = '__' + common.indicatorsRelation[key] + '_location__';

    if (!thread[key]) {
      cell = cell.replace(idString, '');
    } else {
      cell = cell.replace(idString, removable[common.indicatorsRelation[key]]);
    }
  }

  return cell;

};

exports.getCatalogCell = function(boardUri, document, thread, language) {

  var cell = exports.setCatalogCellThumb(thread, language);

  cell = cell.replace('__labelReplies_inner__', thread.postCount || 0);
  cell = cell.replace('__labelImages_inner__', thread.fileCount || 0);
  cell = cell.replace('__labelPage_inner__', thread.page);

  var removable = templateHandler(language, true).catalogCell.removable;

  if (thread.subject) {

    cell = cell.replace('__labelSubject_location__', removable.labelSubject);
    cell = cell.replace('__labelSubject_inner__', thread.subject);

  } else {
    cell = cell.replace('__labelSubject_location__', '');
  }

  cell = exports.setCatalogCellIndicators(thread, cell, removable);

  cell = cell.replace('__divMessage_inner__', thread.markdown);

  return '<div class=\"catalogCell\">' + cell + '</div>';

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

  var children = '';

  for (var i = 0; i < threads.length; i++) {
    children += exports
        .getCatalogCell(boardUri, document, threads[i], language);
  }

  threadsDiv.innerHTML += children;

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
exports.getLatestImages = function(latestImages, language) {

  var cellTemplate = templateHandler(language, true).latestImageCell.template;

  var children = '';

  for (var i = 0; i < latestImages.length; i++) {

    var image = latestImages[i];

    var cell = '<div class=\"latestImageCell\">' + cellTemplate;
    cell += '</div>';

    var postLink = '/' + image.boardUri + '/res/' + image.threadId + '.html';
    postLink += '#' + (image.postId || image.threadId);

    cell = cell.replace('__linkPost_href__', postLink);

    var img = '<img src=\"' + image.thumb + '\">';

    cell = cell.replace('__linkPost_children__', img);

    children += cell;

  }

  return children;

};

exports.getTopBoards = function(boards, language) {

  var cellTemplate = templateHandler(language, true).topBoardCell.template;
  var children = '';

  for (var i = 0; i < boards.length; i++) {

    var board = boards[i];

    var cell = '<div class=\"topBoardCell\">' + cellTemplate;
    cell += '</div>';

    var content = '/' + board.boardUri + '/ - ' + board.boardName;
    cell = cell.replace('__boardLink_inner__', content);

    cell = cell.replace('__boardLink_href__', '/' + board.boardUri + '/');

    children += cell;
  }

  return children;

};

exports.getLatestPosts = function(latestPosts, language) {

  var cellTemplate = templateHandler(language, true).latestPostCell.template;

  var children = '';

  for (var i = 0; i < latestPosts.length; i++) {
    var post = latestPosts[i];

    var cell = '<div class=\"latestPostCell\">' + cellTemplate;
    cell += '</div>';

    cell = cell.replace('__labelPreview_inner__', post.previewText);

    var postLink = '/' + post.boardUri + '/res/' + post.threadId + '.html';
    postLink += '#' + (post.postId || post.threadId);
    cell = cell.replace('__linkPost_href__', postLink);

    var linkText = '>>/' + post.boardUri + '/' + (post.postId || post.threadId);
    cell = cell.replace('__linkPost_inner__', linkText);

    children += cell;

  }

  return children;

};

exports.setEngineInfo = function(document) {

  document = document.replace('__linkEngine_href__',
      'http://gitgud.io/LynxChan/LynxChan');

  var inner = 'LynxChan ' + engineInfo.version;
  document = document.replace('__linkEngine_inner__', inner);

  return document;

};

exports.checkForLatestContent = function(document, latestImages, latestPosts,
    language) {

  var removable = templateHandler(language, true).index.removable;

  if (!latestPosts) {
    document = document.replace('__divLatestPosts_location__', '');
  } else {
    document = document.replace('__divLatestPosts_location__',
        removable.divLatestPosts);

    document = document.replace('__divLatestPosts_children__', exports
        .getLatestPosts(latestPosts, document, language));

  }

  if (!latestImages) {
    document = document.replace('__divLatestImages_location__', '');
  } else {
    document = document.replace('__divLatestImages_location__',
        removable.divLatestImages);
    document = document.replace('__divLatestImages_children__', exports
        .getLatestImages(latestImages, lang));

  }

  return document;

};

exports.setGlobalStats = function(document, globalStats, language) {

  document = document.replace('__divStats_location__', templateHandler(
      language, true).index.removable.divStats);

  document = document.replace('__labelTotalPosts_inner__',
      globalStats.totalPosts || 0);
  document = document.replace('__labelTotalIps_inner__',
      globalStats.totalIps || 0);
  document = document.replace('__labelTotalPPH_inner__',
      globalStats.totalPPH || 0);
  document = document.replace('__labelTotalBoards_inner__',
      globalStats.totalBoards || 0);
  document = document.replace('__labelTotalFiles_inner__',
      globalStats.totalFiles);
  document = document.replace('__labelTotalSize_inner__',
      globalStats.totalSize || 0);

  return document;

};

exports.getFrontPageContent = function(boards, globalStats, latestImages,
    latestPosts, language) {

  var templateData = templateHandler(language, true).index;

  var titleToUse = siteTitle || lang(language).titDefaultChanTitle;

  var document = templateData.template.replace('__title__', titleToUse);

  if (!boards) {
    document = document.replace('__divBoards_location__', '');
  } else {

    document = document.replace('__divBoards_location__',
        templateData.removable.divBoards);

    document = document.replace('__divBoards_children__', exports.getTopBoards(
        boards, language));
  }

  if (globalStats) {
    document = exports.setGlobalStats(document, globalStats, language);
  } else {
    document = document.replace('__divStats_location__', '');
  }

  document = exports.checkForLatestContent(document, latestImages, latestPosts,
      language);

  return exports.setEngineInfo(document);

};

exports.frontPage = function(boards, latestPosts, latestImages, globalStats,
    language, callback) {

  try {

    var document = exports.getFrontPageContent(boards, globalStats,
        latestImages, latestPosts, language);

    var filePath = '/';
    var meta = {
      type : 'frontPage'
    };

    if (language) {
      meta.referenceFile = filePath;
      meta.languages = language.headerValues;
      filePath += language.headerValues.join('-');
    }

    gridFs.writeData(document, filePath, 'text/html', meta, callback);

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
