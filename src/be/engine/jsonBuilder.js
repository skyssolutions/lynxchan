'use strict';

// builds JSON versions of pages

var logger = require('../logger');
var settings;
var cacheHandler;
var miscOps;
var overboard;
var minClearIpRole;
var sfwOverboard;
var version;
var displayMaxSize;
var bypassMode;
var maxAllowedFiles;
var maxFileSizeMB;
var domManipulator;
var redactModNames;
var messageLength;
var reportCategories;
var globalCaptcha;
var noReportCaptcha;
var wsPort;
var wssPort;

exports.loadSettings = function() {

  settings = require('../settingsHandler').getGeneralSettings();

  reportCategories = settings.reportCategories;
  noReportCaptcha = settings.noReportCaptcha;
  redactModNames = settings.redactModNames;
  bypassMode = settings.bypassMode;
  globalCaptcha = settings.forceCaptcha;
  messageLength = settings.messageLength;
  wsPort = settings.wsPort;
  wssPort = settings.wssPort;
  maxAllowedFiles = settings.maxFiles;
  maxFileSizeMB = settings.maxFileSizeMB;
  minClearIpRole = settings.clearIpMinRole;
  sfwOverboard = settings.sfwOverboard;
  overboard = settings.overboard;

  displayMaxSize = domManipulator.formatFileSize(settings.maxFileSizeB);

};

exports.loadDependencies = function() {

  domManipulator = require('./domManipulator').common;
  miscOps = require('./miscOps');
  cacheHandler = require('./cacheHandler');
  version = require('./addonOps').getEngineInfo().version;

};

// Section 1: Shared functions {
exports.getFilesArray = function(fileArray, modding, preview) {

  var toReturn = [];

  if (fileArray) {
    for (var i = 0; i < fileArray.length; i++) {
      var file = fileArray[i];

      var toPush = {
        originalName : file.originalName,
        path : file.path,
        thumb : file.thumb,
        mime : file.mime,
        size : file.size,
        width : file.width,
        height : file.height
      };

      if (modding || preview) {
        toPush.sha256 = file.sha256;
      }

      toReturn.push(toPush);

    }
  }

  return toReturn;

};

exports.appendPostOptionalItems = function(post, toReturn, bData, userRole) {

  if (post.asn) {
    toReturn.asn = post.asn;
  }

  if (post.bypassId) {

    toReturn.bypassId = miscOps.hashIpForDisplay([ post.bypassId ],
        bData.ipSalt, userRole);
  }

  if (post.ip) {

    toReturn.ip = miscOps.hashIpForDisplay(post.ip, bData.ipSalt, userRole);

    var allowedForIps = userRole <= minClearIpRole;

    if (!allowedForIps) {
      toReturn.broadRange = miscOps.hashIpForDisplay(miscOps.getRange(post.ip),
          bData.ipSalt);

      toReturn.narrowRange = miscOps.hashIpForDisplay(miscOps.getRange(post.ip,
          true), bData.ipSalt);
    }
  }

};

exports.getPostObject = function(post, preview, boardData, modding, userRole) {

  var toReturn = {
    name : post.name,
    signedRole : post.signedRole,
    email : post.email,
    flag : post.flag,
    flagName : post.flagName,
    id : post.id,
    subject : post.subject,
    flagCode : post.flagCode,
    lastEditTime : post.lastEditTime,
    lastEditLogin : redactModNames ? undefined : post.lastEditLogin,
    markdown : post.markdown,
    message : post.message,
    banMessage : post.banMessage,
    postId : post.postId,
    creation : post.creation,
    files : exports.getFilesArray(post.files, modding, preview)
  };

  if (modding || preview) {
    exports.appendPostOptionalItems(post, toReturn, boardData, userRole);
  }

  if (preview) {
    toReturn.boardUri = post.boardUri;
    toReturn.threadId = post.threadId;
  }

  return toReturn;
};

exports.buildThreadPosts = function(posts, boardData, modding, userRole) {

  var threadPosts = [];

  if (posts) {

    for (var i = 0; i < posts.length; i++) {

      var post = posts[i];

      var postToAdd = exports.getPostObject(post, false, boardData, modding,
          userRole);

      threadPosts.push(postToAdd);

    }
  }

  return threadPosts;
};

exports.getThreadObject = function(thread, posts, board, modding, userRole) {

  var threadObject = {
    signedRole : thread.signedRole,
    banMessage : thread.banMessage,
    id : thread.id,
    name : thread.name,
    email : thread.email,
    wsPort : wsPort,
    wssPort : wssPort,
    boardUri : thread.boardUri,
    threadId : thread.threadId,
    flag : thread.flag,
    flagCode : thread.flagCode,
    flagName : thread.flagName,
    subject : thread.subject,
    lastEditTime : thread.lastEditTime,
    lastEditLogin : redactModNames ? undefined : thread.lastEditLogin,
    markdown : thread.markdown,
    message : thread.message,
    creation : thread.creation,
    locked : !!thread.locked,
    archived : !!thread.archived,
    pinned : !!thread.pinned,
    cyclic : !!thread.cyclic,
    autoSage : !!thread.autoSage,
    files : exports.getFilesArray(thread.files, modding),
    posts : exports.buildThreadPosts(posts, board, modding, userRole)
  };

  if (posts && posts.length < thread.postCount) {
    threadObject.ommitedPosts = thread.postCount - posts.length;
  }

  if (modding) {
    exports.appendPostOptionalItems(thread, threadObject, board, userRole);
  }

  return threadObject;
};
// } Section 1: Shared functions

// Section 2: Thread {
exports.addExtraThreadInfo = function(threadObject, boardData) {

  threadObject.usesCustomJs = !!boardData.usesCustomJs;
  threadObject.boardName = boardData.boardName;
  threadObject.boardDescription = boardData.boardDescription;
  threadObject.boardMarkdown = boardData.boardMarkdown;

  exports.setFileLimits(threadObject, boardData);

  if (boardData.captchaMode === 2 || globalCaptcha) {
    threadObject.captcha = true;
  }

  if (boardData.settings) {

    if (boardData.settings.indexOf('forceAnonymity') >= 0) {
      threadObject.forceAnonymity = true;
    }

    if (boardData.settings.indexOf('textBoard') >= 0) {
      threadObject.textBoard = true;
    }
  }

};

exports.thread = function(boardUri, boardData, threadData, posts, callback,
    modding, userRole, flagData) {

  var threadObject = exports.getThreadObject(threadData, posts, boardData,
      modding, userRole);

  threadObject.maxMessageLength = messageLength;
  threadObject.usesCustomCss = boardData.usesCustomCss;
  threadObject.noReportCaptcha = noReportCaptcha;
  threadObject.reportCategories = reportCategories;

  exports.addExtraThreadInfo(threadObject, boardData);

  if (flagData && flagData.length) {
    threadObject.flagData = flagData;
  }

  if (modding) {
    return threadObject;
  } else {

    var path = '/' + boardUri + '/res/' + threadData.threadId + '.json';

    cacheHandler.writeData(JSON.stringify(threadObject), path,
        'application/json', {
          boardUri : boardUri,
          threadId : threadData.threadId,
          type : 'thread'
        }, callback);
  }
};
// } Section 2: Thread

// Section 3: Front-page {
exports.getLatestPosts = function(globalLatestPosts) {

  var latestPosts = [];
  if (globalLatestPosts) {
    for (var i = 0; i < globalLatestPosts.length; i++) {
      var post = globalLatestPosts[i];
      latestPosts.push({
        boardUri : post.boardUri,
        threadId : post.threadId,
        postId : post.postId,
        previewText : post.previewText
      });
    }

  }

  return latestPosts;

};

exports.setGlobalStats = function(globalStats, object) {

  if (globalStats) {
    object.totalPosts = globalStats.totalPosts;
    object.totalIps = globalStats.totalIps;
    object.totalPPH = globalStats.totalPPH;
    object.totalBoards = globalStats.totalBoards;
    object.totalFiles = globalStats.totalFiles;
    object.totalSize = globalStats.totalSize;
  }

};

exports.frontPage = function(boards, globalLatestPosts, globalLatestImages,
    globalStats, callback) {

  var topBoards = [];

  if (boards) {
    for (var i = 0; i < boards.length; i++) {

      var board = boards[i];

      topBoards.push({
        boardUri : board.boardUri,
        boardName : board.boardName
      });
    }
  }

  var latestImages = [];

  if (globalLatestImages) {

    for (i = 0; i < globalLatestImages.length; i++) {

      var image = globalLatestImages[i];

      latestImages.push({
        boardUri : image.boardUri,
        threadId : image.threadId,
        postId : image.postId,
        thumb : image.thumb
      });

    }

  }

  var object = {
    topBoards : topBoards,
    latestPosts : exports.getLatestPosts(globalLatestPosts),
    latestImages : latestImages,
    version : version
  };

  exports.setGlobalStats(globalStats, object);

  cacheHandler.writeData(JSON.stringify(object), '/index.json',
      'application/json', {
        type : 'frontPage'
      }, callback);

};
// } Section 3: Front-page

exports.setFileLimits = function(toWrite, bData) {

  if (bData.maxFiles) {
    toWrite.maxFileCount = bData.maxFiles < maxAllowedFiles ? bData.maxFiles
        : maxAllowedFiles;
  } else {
    toWrite.maxFileCount = maxAllowedFiles;
  }

  if (bData.maxFileSizeMB && bData.maxFileSizeMB < maxFileSizeMB) {
    toWrite.maxFileSize = domManipulator
        .formatFileSize(bData.maxFileSizeMB * 1048576);
  } else {
    toWrite.maxFileSize = displayMaxSize;
  }

};

exports.finalizePageData = function(pageCount, boardData, threadsToAdd,
    flagData) {

  var toWrite = {
    pageCount : pageCount,
    boardName : boardData.boardName,
    boardDescription : boardData.boardDescription || '',
    settings : boardData.settings,
    threads : threadsToAdd,
    maxMessageLength : messageLength,
    globalCaptcha : globalCaptcha,
    captchaMode : boardData.captchaMode,
    noReportCaptcha : noReportCaptcha,
    reportCategories : reportCategories
  };

  exports.setFileLimits(toWrite, boardData);

  if (flagData && flagData.length) {
    toWrite.flagData = flagData;
  }

  return toWrite;

};

exports.page = function(boardUri, page, threads, pageCount, boardData,
    flagData, latestPosts, mod, userRole, callback) {

  var threadsToAdd = [];

  if (threads) {

    var tempLatest = {};

    for (var i = 0; i < latestPosts.length; i++) {

      tempLatest[latestPosts[i]._id] = latestPosts[i].latestPosts;
    }

    latestPosts = tempLatest;

    for (i = 0; i < threads.length; i++) {
      var thread = threads[i];

      threadsToAdd.push(exports.getThreadObject(thread,
          latestPosts[thread.threadId], boardData, mod, userRole));

    }
  }

  var toWrite = exports.finalizePageData(pageCount, boardData, threadsToAdd,
      flagData);

  if (mod) {
    return callback(null, toWrite);
  }

  var ownName = '/' + boardUri + '/' + page + '.json';

  cacheHandler.writeData(JSON.stringify(toWrite), ownName, 'application/json',
      {
        boardUri : boardUri,
        type : 'page',
        page : page
      }, callback);

};

exports.catalog = function(boardUri, threads, callback) {

  var threadsArray = [];

  for (var i = 0; i < threads.length; i++) {
    var thread = threads[i];

    var threadToPush = {
      message : thread.message,
      markdown : thread.markdown,
      threadId : thread.threadId,
      postCount : thread.postCount,
      fileCount : thread.fileCount,
      page : thread.page,
      subject : thread.subject,
      locked : !!thread.locked,
      pinned : !!thread.pinned,
      cyclic : !!thread.cyclic,
      autoSage : !!thread.autoSage,
      lastBump : thread.lastBump,
    };

    if (thread.files && thread.files.length) {
      threadToPush.thumb = thread.files[0].thumb;
      threadToPush.mime = thread.files[0].mime;
    }

    threadsArray.push(threadToPush);
  }

  var path = '/' + boardUri + '/catalog.json';

  cacheHandler.writeData(JSON.stringify(threadsArray), path,
      'application/json', {
        boardUri : boardUri,
        type : 'catalog'
      }, callback);

};

exports.rules = function(boardUri, rules, callback) {
  cacheHandler.writeData(JSON.stringify(rules), '/' + boardUri + '/rules.json',
      'application/json', {
        boardUri : boardUri,
        type : 'rules'
      }, callback);
};

exports.boardManagement = function(userData, boardData, languages, bans,
    reportCount) {

  return {
    usesCustomSpoiler : boardData.usesCustomSpoiler,
    volunteers : boardData.volunteers || [],
    availableLanguages : languages || [],
    preferredLanguage : boardData.preferredLanguage,
    boardName : boardData.boardName,
    boardDescription : boardData.boardDescription || '',
    anonName : boardData.anonymousName,
    hourlyThreadLimit : boardData.hourlyThreadLimit,
    autoCaptchaThreshold : boardData.autoCaptchaThreshold,
    settings : boardData.settings || [],
    tags : boardData.tags || [],
    openReports : reportCount,
    boardMessage : boardData.boardMessage,
    isOwner : userData.login === boardData.owner,
    appealedBans : bans || [],
    autoSageLimit : boardData.autoSageLimit || settings.autoSageLimit,
    maxThreadCount : boardData.maxThreadCount || settings.maxThreadCount,
    maxFileSizeMB : boardData.maxFileSizeMB || settings.maxFileSizeMB,
    acceptedMimes : boardData.acceptedMimes || settings.acceptedMimes,
    maxFiles : boardData.maxFiles || settings.maxFiles,
    captchaMode : boardData.captchaMode || 0,
    locationFlagMode : boardData.locationFlagMode || 0,
    maxBumpAgeDays : boardData.maxBumpAgeDays
  };

};

exports.closedReports = function(closedReports) {
  return JSON.stringify(closedReports);
};

exports.boards = function(pageCount, boards) {

  return {
    pageCount : pageCount,
    boards : boards,
    overboard : overboard,
    sfwOverboard : sfwOverboard
  };

};

exports.rangeBans = function(rangeBans, boardData, userRole) {

  for (var i = 0; i < rangeBans.length; i++) {

    var rangeBan = rangeBans[i];

    if (boardData) {
      rangeBans[i].range = miscOps.hashIpForDisplay(rangeBan.range,
          boardData.ipSalt, userRole, rangeBan.ipv6);
    } else {
      rangeBans[i].range = miscOps.formatIp(rangeBan.range, rangeBan.ipv6);

    }

  }

  return rangeBans;

};

exports.globalSettings = function() {

  var toOutput = {};

  var settingsRelation = miscOps.getParametersArray();

  for (var i = 0; i < settingsRelation.length; i++) {
    var setting = settingsRelation[i];
    toOutput[setting.setting] = settings[setting.setting];
  }

  return toOutput;

};

exports.overboard = function(foundThreads, previewRelation, callback,
    boardList, sfw) {

  var threadsToAdd = [];

  for (var i = 0; i < foundThreads.length; i++) {

    var thread = foundThreads[i];

    var posts = [];

    if (previewRelation[thread.boardUri]) {
      posts = previewRelation[thread.boardUri][thread.threadId];
    }

    threadsToAdd.push(exports.getThreadObject(thread, posts));

  }

  if (boardList) {
    var url = '/' + boardList.join('+') + '/1.json';
  } else {
    url = '/' + (sfw ? sfwOverboard : overboard) + '/1.json';
  }

  cacheHandler.writeData(JSON.stringify({
    threads : threadsToAdd,
    noReportCaptcha : noReportCaptcha,
    reportCategories : reportCategories
  }), url, 'application/json', {
    boards : boardList,
    type : boardList ? 'multiboard' : 'overboard'
  }, callback);

};

exports.log = function(logData, logs, callback) {

  if (redactModNames) {
    logs = logs.map(function(element) {
      delete element.user;
      return element;
    });
  }

  var path = '/.global/logs/' + (logData.boardUri || '.global');
  path += '/' + logger.formatedDate(logData.date) + '.json';

  cacheHandler.writeData(JSON.stringify(logs), path, 'application/json', {
    type : 'log',
    boardUri : logData.boardUri || '.global',
    date : logData.date.toUTCString()
  }, callback);

};

exports.blockBypass = function(bypass) {

  return {
    valid : bypass ? true : false,
    validated : bypass && (bypass.validated || !bypass.validationCode),
    mode : bypassMode
  };

};

exports.message = function(status, data) {

  return JSON.stringify({
    status : status,
    data : data
  });

};

exports.latestPostings = function(postings, user, boardData) {

  for (var i = 0; i < postings.length; i++) {

    var posting = postings[i];

    postings[i] = exports.getPostObject(posting, true,
        boardData[posting.boardUri], false, user.globalRole);
  }

  return postings;

};

exports.openReports = function(reports) {

  return {
    reports : reports,
    reportCategories : reportCategories
  };

};