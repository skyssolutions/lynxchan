'use strict';

// handles static pages. Note: thread pages can also be output as a dynamic
// page by form/mod.js

var kernel = require('../../kernel');
var individualCaches = !kernel.feDebug();
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
var verbose;
var clearIpMinRole;
var overboard;
var sfwOverboard;
var siteTitle;
var engineInfo;
var disableCatalogPosting;
var boardStaffArchiving;
var cacheHandler;

exports.availableLogTypes = {
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
  appealDeny : 'guiTypeAppealDeny',
  mediaDeletion : 'guiTypeMediaDeletion',
  filePruning : 'guiTypeFilePruning'
};

exports.loadSettings = function() {
  var settings = require('../../settingsHandler').getGeneralSettings();

  verbose = settings.verbose || settings.verboseCache;
  boardStaffArchiving = settings.allowBoardStaffArchiving;
  disableCatalogPosting = settings.disableCatalogPosting;
  sfwOverboard = settings.sfwOverboard;
  overboard = settings.overboard;
  accountCreationDisabled = settings.disableAccountCreation;
  siteTitle = settings.siteTitle;
  clearIpMinRole = settings.clearIpMinRole;

};

exports.loadDependencies = function() {

  cacheHandler = require('../cacheHandler');
  miscOps = require('../miscOps');
  engineInfo = require('../addonOps').getEngineInfo();
  common = require('.').common;
  templateHandler = require('../templateHandler').getTemplates;
  lang = require('../langOps').languagePack;
  gridFs = require('../gridFsHandler');

};

exports.notFound = function(language, callback) {

  var document = templateHandler(language).notFoundPage.template.replace(
      '__title__', lang(language).titNotFound);

  var path = '/404.html';
  var meta = {
    status : 404
  };

  if (language) {
    meta.referenceFile = path;
    meta.languages = language.headerValues;
    path += language.headerValues.join('-');
  }

  gridFs.writeData(document, path, 'text/html', meta, callback);

};

exports.login = function(language, callback) {

  var template = templateHandler(language).loginPage;

  var document = template.template
      .replace('__title__', lang(language).titLogin);

  if (accountCreationDisabled) {
    document = document.replace('__divCreation_location__', '');
  } else {
    document = document.replace('__divCreation_location__',
        template.removable.divCreation);
  }

  var path = '/login.html';
  var meta = {};

  if (language) {
    meta.referenceFile = path;
    meta.languages = language.headerValues;
    path += language.headerValues.join('-');
  }

  gridFs.writeData(document, path, 'text/html', meta, callback);

};

// Section 1: Thread {
exports.setModdingInformation = function(document, threadData) {

  if (threadData.locked) {
    document = document.replace('__checkboxLock_checked__', 'true');
  } else {
    document = document.replace('checked="__checkboxLock_checked__"', '');
  }

  if (threadData.pinned) {
    document = document.replace('__checkboxPin__', 'true');
  } else {
    document = document.replace('checked="__checkboxPin_checked__"', '');
  }

  if (threadData.cyclic) {
    document = document.replace('__checkboxCyclic_checked__', 'true');
  } else {
    document = document.replace('checked="__checkboxCyclic_checked__"', '');
  }

  document = document.replace('__archiveBoardIdentifier_value__', common
      .clean(threadData.boardUri));
  document = document.replace('__archiveThreadIdentifier_value__',
      threadData.threadId);

  document = document.replace('__controlBoardIdentifier_value__', common
      .clean(threadData.boardUri));
  document = document.replace('__controlThreadIdentifier_value__',
      threadData.threadId);

  document = document.replace('__transferThreadIdentifier_value__',
      threadData.threadId);

  return document.replace('__transferBoardIdentifier_value__', common
      .clean(threadData.boardUri));

};

exports.setThreadTitle = function(document, threadData) {

  var title = '/' + common.clean(threadData.boardUri) + '/ - ';

  if (threadData.subject) {
    title += common.clean(threadData.subject);
  } else {
    title += common.clean(threadData.message.substring(0, 256));
  }

  return document.replace('__title__', title);

};

exports.setModElements = function(modding, document, userRole, removable,
    archived) {

  var globalStaff = userRole <= miscOps.getMaxStaffRole();
  if (!globalStaff || !modding) {
    document = document.replace('__formTransfer_location__', '');
  } else {
    document = document.replace('__formTransfer_location__',
        removable.formTransfer);
  }

  var allowedToDeleteFromIp = userRole <= clearIpMinRole;

  if (!modding || !allowedToDeleteFromIp) {
    document = document.replace('__ipDeletionForm_location__', '');
  } else {
    document = document.replace('__ipDeletionForm_location__',
        removable.ipDeletionForm);
  }

  var allowedToArchive = userRole <= 2 || boardStaffArchiving;

  if (archived || !modding || !allowedToArchive) {
    document = document.replace('__divArchive_location__', '');
  } else {
    document = document
        .replace('__divArchive_location__', removable.divArchive);
  }

  return document;

};

exports.setThreadCommonInfo = function(template, threadData, boardData,
    language, flagData, posts, modding, userRole) {

  var document = common.setHeader(template, language, boardData, flagData,
      threadData);

  document = exports.setThreadTitle(document, threadData);

  var linkModeration = '/mod.js?boardUri=' + common.clean(boardData.boardUri);
  linkModeration += '&threadId=' + threadData.threadId;
  document = document.replace('__linkMod_href__', linkModeration);

  document = document.replace('__linkManagement_href__',
      '/boardManagement.js?boardUri=' + common.clean(boardData.boardUri));

  var operations = [];

  document = document.replace('__divThreads_children__', common.getThread(
      threadData, posts, true, modding, boardData, userRole, language,
      operations));

  common.handleOps(operations);

  document = document
      .replace('__threadIdentifier_value__', threadData.threadId);

  return exports.setModElements(modding, document, userRole,
      template.removable, threadData.archived);

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

exports.thread = function(boardData, flagData, threadData, posts, callback,
    modding, userRole, language) {

  var boardUri = boardData.boardUri;

  var template = templateHandler(language).threadPage;

  var document = exports.setThreadCommonInfo(template, threadData, boardData,
      language, flagData, posts, modding, userRole);

  if (modding) {

    document = document.replace('__divControls_location__',
        template.removable.divControls);
    document = document.replace('__divMod_location__',
        template.removable.divMod);

    document = exports.setModdingInformation(document, threadData);

    callback(null, document);

  } else {

    document = document.replace('__divControls_location__', '');
    document = document.replace('__divMod_location__', '');

    var meta = {
      boardUri : boardUri,
      type : 'thread',
      threadId : threadData.threadId
    };

    var path = exports.getThreadPathAndMeta(boardUri, language, meta,
        threadData);

    cacheHandler.writeData(document, path, 'text/html', meta, callback);
  }

};
// } Section 1: Thread

// Section 2: Board {
exports.getThreadListing = function(latestPosts, threads, language) {

  var children = '';

  var tempLatest = {};

  for (var i = 0; i < latestPosts.length; i++) {

    tempLatest[latestPosts[i]._id] = latestPosts[i].latestPosts;
  }

  latestPosts = tempLatest;

  var operations = [];

  for (i = 0; i < threads.length; i++) {
    var thread = threads[i];

    children += common.getThread(thread, latestPosts[thread.threadId], null,
        null, null, null, language, operations);

  }

  common.handleOps(operations);

  return children;

};

exports.addPagesLinks = function(document, pageCount, currentPage, removable) {

  if (currentPage === 1) {
    document = document.replace('__linkPrevious_location__', '');
  } else {
    document = document.replace('__linkPrevious_location__',
        removable.linkPrevious);
    document = document.replace('__linkPrevious_href__',
        currentPage > 2 ? currentPage - 1 + '.html' : 'index.html');
  }

  if (pageCount === currentPage) {
    document = document.replace('__linkNext_location__', '');
  } else {
    document = document.replace('__linkNext_location__', removable.linkNext);

    var nextPageHref = (currentPage + 1) + '.html';
    document = document.replace('__linkNext_href__', nextPageHref);
  }

  var children = '';

  for (var i = 0; i < pageCount; i++) {

    var pageName = i ? (i + 1) + '.html' : 'index.html';

    children += '<a href="' + pageName + '">' + (i + 1) + '</a>';
  }

  return document.replace('__divPages_children__', children);

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

exports.page = function(page, threads, pageCount, boardData, flagData,
    latestPosts, language, cb) {

  var template = templateHandler(language).boardPage;

  var document = common
      .setHeader(template, language, boardData, flagData, null);

  var boardUri = common.clean(boardData.boardUri);

  var title = '/' + boardUri + '/ - ' + common.clean(boardData.boardName);
  document = document.replace('__title__', title);

  document = document.replace('__linkManagement_href__',
      '/boardManagement.js?boardUri=' + boardUri);

  document = document.replace('__linkModeration_href__',
      '/boardModeration.js?boardUri=' + boardUri);

  document = exports.addPagesLinks(document, pageCount, page,
      template.removable);

  document = document.replace('__divThreads_children__', exports
      .getThreadListing(latestPosts, threads, language));

  var meta = {
    boardUri : boardUri,
    type : 'page',
    page : page
  };

  var path = exports.getPagePathAndMeta(boardData.boardUri, page, meta,
      language);

  cacheHandler.writeData(document, path, 'text/html', meta, cb);

};
// } Section 2: Board

// Section 3: Catalog {
exports.setCatalogCellThumb = function(thread, language) {

  common.clean(thread);

  var href = '/' + thread.boardUri + '/res/';
  href += thread.threadId + '.html';

  var cell = templateHandler(language).catalogCell.template.replace(
      '__linkThumb_href__', href);

  if (thread.files && thread.files.length) {
    var img = '<img src="' + common.clean(thread.files[0].thumb) + '">';
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

  var removable = templateHandler(language).catalogCell.removable;

  if (thread.subject) {

    cell = cell.replace('__labelSubject_location__', removable.labelSubject);
    cell = cell.replace('__labelSubject_inner__', thread.subject);

  } else {
    cell = cell.replace('__labelSubject_location__', '');
  }

  cell = exports.setCatalogCellIndicators(thread, cell, removable);

  cell = cell.replace('__divMessage_inner__', common
      .matchCodeTags(thread.markdown));

  return '<div class="catalogCell">' + cell + '</div>';

};

exports.setCatalogPosting = function(boardData, flagData, document, language,
    removable) {

  if (!disableCatalogPosting) {
    document = document.replace('__postingForm_location__',
        removable.postingForm);

    document = common.setBoardPosting(boardData, flagData, document, null,
        language, removable);

  } else {
    document = document.replace('__postingForm_location__', '');
  }

  return document;

};

exports.setCatalogElements = function(boardData, language, threads, flagData) {

  var template = templateHandler(language).catalogPage;

  var document = template.template;

  var boardUri = common.clean(boardData.boardUri);

  document = document.replace('__title__', lang(language).titCatalog.replace(
      '{$board}', boardUri));

  document = document.replace('__labelBoard_inner__', '/' + boardUri + '/');

  document = exports.setCatalogPosting(boardData, flagData, document, language,
      template.removable);

  var children = '';

  for (var i = 0; i < threads.length; i++) {
    children += exports
        .getCatalogCell(boardUri, document, threads[i], language);
  }

  if (boardData.usesCustomCss) {
    document = common.setCustomCss(boardUri, document);
  } else {
    document = document.replace('__head_children__', '');
  }

  return document.replace('__divThreads_children__', children);

};

exports.catalog = function(language, boardData, threads, flagData, callback) {

  var document = exports.setCatalogElements(boardData, language, threads,
      flagData);

  var path = '/' + boardData.boardUri + '/catalog.html';

  var meta = {
    boardUri : boardData.boardUri,
    type : 'catalog'
  };

  if (language) {
    meta.languges = language.headerValues;
    meta.referenceFile = path;
    path += language.headerValues.join('-');
  }

  cacheHandler.writeData(document, path, 'text/html', meta, callback);

};
// } Section 3: Catalog

// Section 4: Front page {
exports.getLatestImages = function(latestImages, language) {

  var children = '';

  for (var i = 0; i < latestImages.length; i++) {

    var image = latestImages[i];

    var boardUri = common.clean(image.boardUri);

    var postLink = '/' + boardUri + '/res/' + image.threadId + '.html';
    postLink += '#' + (image.postId || image.threadId);

    var cell = '<a href="' + postLink + '"><img src="' + image.thumb + '">';

    children += cell + '</a>';

  }

  return children;

};

exports.getTopBoards = function(boards, language) {

  var children = '';

  for (var i = 0; i < boards.length; i++) {

    var board = boards[i];

    var boardUri = common.clean(board.boardUri);
    var boardName = common.clean(board.boardName);

    var cell = '<a href="/' + boardUri + '/">/' + boardUri + '/ - ';

    children += cell + boardName + '</a>';
  }

  return children;

};

exports.getLatestPosts = function(latestPosts, language) {

  var cellTemplate = templateHandler(language).latestPostCell.template;

  var children = '';

  for (var i = 0; i < latestPosts.length; i++) {
    var post = latestPosts[i];

    common.clean(post);

    var cell = '<div class="latestPostCell">' + cellTemplate;
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

  var removable = templateHandler(language).index.removable;

  if (!latestPosts) {
    document = document.replace('__divLatestPosts_location__', '');
  } else {
    document = document.replace('__divLatestPosts_location__',
        removable.divLatestPosts);

    document = document.replace('__divLatestPosts_children__', exports
        .getLatestPosts(latestPosts, language));

  }

  if (!latestImages) {
    document = document.replace('__divLatestImages_location__', '');
  } else {
    document = document.replace('__divLatestImages_location__',
        removable.divLatestImages);
    document = document.replace('__divLatestImages_children__', exports
        .getLatestImages(latestImages, language));

  }

  return document;

};

exports.setGlobalStats = function(document, globalStats, language) {

  document = document.replace('__divStats_location__',
      templateHandler(language).index.removable.divStats);

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

  var templateData = templateHandler(language).index;

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

  var document = exports.getFrontPageContent(boards, globalStats, latestImages,
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

  cacheHandler.writeData(document, filePath, 'text/html', meta, callback);

};
// } Section 4: Front page

exports.maintenance = function(language, callback) {

  var document = templateHandler(language).maintenancePage.template.replace(
      '__title__', lang(language).titMaintenance);

  var path = '/maintenance.html';
  var meta = {
    status : 200
  };

  if (language) {
    meta.referenceFile = path;
    meta.languages = language.headerValues;
    path += language.headerValues.join('-');
  }

  gridFs.writeData(document, path, 'text/html', meta, callback);

};

// Section 5: Overboard {
exports.getOverboardThreads = function(foundThreads, foundPreviews, language) {

  var children = '';

  var operations = [];

  for (var i = 0; i < foundThreads.length; i++) {
    var thread = foundThreads[i];

    var previews = [];

    if (foundPreviews[thread.boardUri]) {
      previews = foundPreviews[thread.boardUri][thread.threadId];
    }

    children += common.getThread(thread, previews, null, null, null, null,
        language, operations);

  }

  common.handleOps(operations);

  var template = templateHandler(language).overboard.template;
  return template.replace('__divThreads_children__', children);

};

exports.overboard = function(foundThreads, previewRelation, callback,
    boardList, sfw, language) {

  var document = exports.getOverboardThreads(foundThreads, previewRelation,
      language);

  if (boardList) {
    var title = lang(language).titMultiboard;
    var path = '/' + boardList.join('+') + '/';
  } else {
    title = '/' + (sfw ? sfwOverboard : overboard) + '/';
    path = title;
  }

  var meta = {
    type : boardList ? 'multiboard' : 'overboard',
    boards : boardList
  };

  if (language) {
    meta.referenceFile = path;
    meta.languages = language.headerValues;
    path += language.headerValues.join('-');
  }

  document = document.replace('__title__', title);

  cacheHandler.writeData(document, path, 'text/html', meta, callback);

};
// } Section 5: Overboard

// Section 6: Log page {
exports.getLogEntry = function(template, log, language) {

  var cell = template.template;

  if (!log.global) {
    cell = cell.replace('__indicatorGlobal_location__', '');
  } else {
    cell = cell.replace('__indicatorGlobal_location__',
        template.removable.indicatorGlobal);
  }

  cell = cell.replace('__labelType_inner__',
      lang(language)[exports.availableLogTypes[log.type]]);

  cell = cell.replace('__labelTime_inner__', common.formatDateToDisplay(
      log.time, null, language));

  cell = cell.replace('__labelBoard_inner__', common.clean(log.boardUri || ''));

  cell = cell.replace('__labelUser_inner__', common.clean(log.user || ''));

  cell = cell.replace('__labelDescription_inner__', common
      .clean(log.description));

  return cell;

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

exports.getLogCell = function(logEntry, language) {

  var logCell = '<div class="logCell">';

  var existingCache = exports.getLogEntryCache(logEntry, language);

  if (!existingCache || !individualCaches) {

    var cellContent = exports.getLogEntry(templateHandler(language).logCell,
        logEntry, language);

    logCell += cellContent;

    if (individualCaches) {

      if (verbose) {
        console.log('Writing log individual cache');
      }

      staffLogs.updateOne({
        _id : logEntry._id
      }, {
        $set : exports.getLogEntryCacheObject(cellContent, language)
      });
    }

  } else {
    logCell += existingCache;
  }

  return logCell + '</div>';

};

exports.log = function(language, date, logs, callback) {

  var document = templateHandler(language).logsPage.template.replace(
      '__title__', lang(language).titLogPage.replace('{$date}', common
          .formatDateToDisplay(date, true, language)));

  var children = '';

  for (var i = 0; i < logs.length; i++) {
    children += exports.getLogCell(logs[i], language);
  }

  document = document.replace('__divLogs_children__', children);

  var path = '/.global/logs/';
  path += logger.formatedDate(date) + '.html';

  var meta = {
    type : 'log',
    date : date.toUTCString()
  };

  if (language) {
    meta.languages = language.headerValues;
    meta.referenceFile = path;
    path += language.headerValues.join('-');
  }

  cacheHandler.writeData(document, path, 'text/html', meta, callback);

};
// Section 6: Log page {

// Section 7: Rules {
exports.getRulesDocument = function(language, boardUri, rules) {

  boardUri = common.clean(boardUri);

  var document = templateHandler(language).rulesPage.template.replace(
      '__title__', lang(language).titRules.replace('{$board}', boardUri));

  document = document.replace('__boardLabel_inner__', boardUri);

  var children = '';

  var cellTemplate = templateHandler(language).ruleCell.template;

  for (var i = 0; i < rules.length; i++) {

    var cell = '<div class="ruleCell">' + cellTemplate;

    cell = cell.replace('__textLabel_inner__', rules[i]);

    children += cell.replace('__indexLabel_inner__', i + 1) + '</div>';

  }

  return document.replace('__divRules_children__', children);

};

exports.rules = function(language, boardUri, rules, callback) {

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

  cacheHandler.writeData(exports.getRulesDocument(language, boardUri, rules),
      path, 'text/html', meta, callback);

};
// } Section 7: Rules
