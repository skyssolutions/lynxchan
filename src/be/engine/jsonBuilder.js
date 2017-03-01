'use strict';

// builds JSON versions of pages

var logger = require('../logger');
var settings;
var gridFsHandler;
var miscOps;
var overboard;
var minClearIpRole;
var sfwOverboard;
var version;
var boardCreationRequirement;
var displayMaxSize;
var maxAllowedFiles;
var maxFileSizeMB;
var domManipulator;
var messageLength;
var globalCaptcha;

exports.loadSettings = function() {

  settings = require('../settingsHandler').getGeneralSettings();

  globalCaptcha = settings.forceCaptcha;
  messageLength = settings.messageLength;
  maxAllowedFiles = settings.maxFiles;
  maxFileSizeMB = settings.maxFileSizeMB;
  minClearIpRole = settings.clearIpMinRole;
  sfwOverboard = settings.sfwOverboard;
  overboard = settings.overboard;
  boardCreationRequirement = settings.boardCreationRequirement;

  displayMaxSize = domManipulator.formatFileSize(settings.maxFileSizeB);

};

exports.loadDependencies = function() {

  domManipulator = require('./domManipulator').common;
  miscOps = require('./miscOps');
  gridFsHandler = require('./gridFsHandler');
  version = require('./addonOps').getEngineInfo().version;

};

// Section 1: Shared functions {
exports.getFilesArray = function(fileArray, modding) {

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

      if (modding) {
        toPush.md5 = file.md5;
      }

      toReturn.push(toPush);

    }
  }

  return toReturn;

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
    lastEditLogin : post.lastEditLogin,
    markdown : post.markdown,
    message : post.message,
    banMessage : post.banMessage,
    creation : post.creation,
    files : exports.getFilesArray(post.files, modding)
  };

  if (modding && post.ip) {
    toReturn.ip = miscOps.hashIpForDisplay(post.ip, boardData.ipSalt, userRole);

    var allowedForIps = userRole <= minClearIpRole;

    if (!allowedForIps) {
      toReturn.broadRange = miscOps.hashIpForDisplay(miscOps.getRange(post.ip),
          boardData.ipSalt);

      toReturn.narrowRange = miscOps.hashIpForDisplay(miscOps.getRange(post.ip,
          true), boardData.ipSalt);
    }

  }

  if (!preview) {
    toReturn.postId = post.postId;
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
    boardUri : thread.boardUri,
    threadId : thread.threadId,
    flag : thread.flag,
    flagCode : thread.flagCode,
    flagName : thread.flagName,
    subject : thread.subject,
    lastEditTime : thread.lastEditTime,
    lastEditLogin : thread.lastEditLogin,
    markdown : thread.markdown,
    message : thread.message,
    creation : thread.creation,
    locked : thread.locked ? true : false,
    pinned : thread.pinned ? true : false,
    cyclic : thread.cyclic ? true : false,
    autoSage : thread.autoSage ? true : false,
    files : exports.getFilesArray(thread.files, modding),
    posts : exports.buildThreadPosts(posts, board, modding, userRole)
  };

  if (posts && posts.length < thread.postCount) {
    threadObject.ommitedPosts = thread.postCount - posts.length;
  }

  if (modding && thread.ip) {
    threadObject.ip = miscOps.hashIpForDisplay(thread.ip, board.ipSalt,
        userRole);

    var allowedForIps = userRole <= minClearIpRole;

    if (!allowedForIps) {
      threadObject.broadRange = miscOps.hashIpForDisplay(miscOps
          .getRange(thread.ip), board.ipSalt);

      threadObject.narrowRange = miscOps.hashIpForDisplay(miscOps.getRange(
          thread.ip, true), board.ipSalt);
    }

  }

  return threadObject;
};
// } Section 1: Shared functions

exports.thread = function(boardUri, boardData, threadData, posts, callback,
    modding, userRole, flagData) {

  var threadObject = exports.getThreadObject(threadData, posts, boardData,
      modding, userRole);

  if (flagData && flagData.length) {
    threadObject.flagData = flagData;
  }

  if (modding) {
    return JSON.stringify(threadObject);

  } else {

    var path = '/' + boardUri + '/res/' + threadData.threadId + '.json';

    gridFsHandler.writeData(JSON.stringify(threadObject), path,
        'application/json', {
          boardUri : boardUri,
          threadId : threadData.threadId,
          type : 'thread'
        }, callback);
  }
};

// Section 2: Front-page {
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

  gridFsHandler.writeData(JSON.stringify(object), '/index.json',
      'application/json', {}, callback);

};
// } Section 2: Front-page

exports.preview = function(postingData, callback) {

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
    path += postingData.threadId;
  }

  path += '.json';

  gridFsHandler.writeData(JSON.stringify(exports.getPostObject(postingData,
      true)), path, 'application/json', metadata, callback);

};

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

exports.page = function(boardUri, page, threads, pageCount, boardData,
    flagData, latestPosts, callback) {

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
          latestPosts[thread.threadId]));

    }
  }

  var ownName = '/' + boardUri + '/' + page + '.json';

  var toWrite = {
    pageCount : pageCount,
    boardName : boardData.boardName,
    boardDescription : boardData.boardDescription,
    settings : boardData.settings,
    threads : threadsToAdd,
    maxMessageLength : messageLength,
    globalCaptcha : globalCaptcha,
    captchaMode : boardData.captchaMode
  };

  exports.setFileLimits(toWrite, boardData);

  if (flagData && flagData.length) {
    toWrite.flagData = flagData;
  }

  gridFsHandler.writeData(JSON.stringify(toWrite), ownName, 'application/json',
      {
        boardUri : boardUri,
        type : 'board'
      }, callback);

};

exports.catalog = function(boardUri, threads, callback) {

  var threadsArray = [];

  for (var i = 0; i < threads.length; i++) {
    var thread = threads[i];

    var threadToPush = {
      message : thread.message,
      threadId : thread.threadId,
      postCount : thread.postCount,
      fileCount : thread.fileCount,
      page : thread.page,
      subject : thread.subject,
      locked : thread.locked ? true : false,
      pinned : thread.pinned ? true : false,
      cyclic : thread.cyclic ? true : false,
      autoSage : thread.autoSage ? true : false,
      lastBump : thread.lastBump,
    };

    if (thread.files && thread.files.length) {
      threadToPush.thumb = thread.files[0].thumb;
    }

    threadsArray.push(threadToPush);
  }

  var path = '/' + boardUri + '/catalog.json';

  gridFsHandler.writeData(JSON.stringify(threadsArray), path,
      'application/json', {
        boardUri : boardUri,
        type : 'catalog'
      }, callback);

};

exports.rules = function(boardUri, rules, callback) {
  gridFsHandler.writeData(JSON.stringify(rules),
      '/' + boardUri + '/rules.json', 'application/json', {
        boardUri : boardUri,
        type : 'rules'
      }, callback);
};

exports.account = function(userData) {

  var allowed = userData.globalRole <= boardCreationRequirement;

  allowed = allowed || boardCreationRequirement > miscOps.getMaxStaffRole();

  return JSON.stringify({
    login : userData.login,
    email : userData.email || '',
    ownedBoards : userData.ownedBoards || [],
    settings : userData.settings || [],
    volunteeredBoards : userData.volunteeredBoards || [],
    boardCreationAllowed : allowed
  });

};

exports.globalManagement = function(userRole, userLogin, staff, reports,
    appealedBans) {

  return JSON.stringify({
    login : userLogin,
    globalRole : isNaN(userRole) ? 4 : userRole,
    staff : staff || [],
    appealedBans : appealedBans || [],
    reports : reports || []
  });

};

exports.boardManagement = function(userData, boardData, reports, bans) {

  return JSON.stringify({
    usesCustomSpoiler : boardData.usesCustomSpoiler,
    volunteers : boardData.volunteers || [],
    boardName : boardData.boardName,
    boardDescription : boardData.boardDescription,
    anonName : boardData.anonymousName,
    hourlyThreadLimit : boardData.hourlyThreadLimit,
    autoCaptchaThreshold : boardData.autoCaptchaThreshold,
    settings : boardData.settings || [],
    tags : boardData.tags || [],
    boardMessage : boardData.boardMessage,
    isOwner : userData.login === boardData.owner,
    openReports : reports || [],
    appealedBans : bans || [],
    autoSageLimit : boardData.autoSageLimit || settings.autoSageLimit,
    maxThreadCount : boardData.maxThreadCount || settings.maxThreadCount,
    maxFileSizeMB : boardData.maxFileSizeMB || settings.maxFileSizeMB,
    acceptedMimes : boardData.acceptedMimes || settings.acceptedMimes,
    maxFiles : boardData.maxFiles || settings.maxFiles,
    captchaMode : boardData.captchaMode || 0,
    locationFlagMode : boardData.locationFlagMode || 0,
    maxBumpAgeDays : boardData.maxBumpAgeDays
  });

};

exports.closedReports = function(closedReports) {
  return JSON.stringify(closedReports);
};

exports.bans = function(bans) {
  return JSON.stringify(bans);
};

exports.bannerManagement = function(boardUri, banners) {
  return JSON.stringify(banners);
};

exports.logs = function(dates) {
  return JSON.stringify(dates);
};

exports.filterManagement = function(filters) {

  return JSON.stringify(filters);

};

exports.boardModeration = function(boardData, ownerData) {

  return JSON.stringify({
    owner : ownerData.login,
    specialSettings : boardData.specialSettings || [],
    lastSeen : ownerData.lastSeen
  });

};

exports.boards = function(pageCount, boards) {

  return JSON.stringify({
    pageCount : pageCount,
    boards : boards,
    overboard : overboard,
    sfwOverboard : sfwOverboard
  });

};

exports.rangeBans = function(rangeBans, boardData) {

  for (var i = 0; i < rangeBans.length; i++) {

    if (boardData) {
      rangeBans[i].range = miscOps.hashIpForDisplay(rangeBans[i].range,
          boardData.ipSalt);
    } else {
      rangeBans[i].range = rangeBans[i].range.join('.');

    }

  }

  return JSON.stringify(rangeBans);

};

exports.hashBans = function(hashBans) {
  return JSON.stringify(hashBans);
};

exports.ruleManagement = function(rules) {
  return JSON.stringify(rules);
};

exports.edit = function(message) {

  return JSON.stringify({
    message : message
  });

};

exports.flagManagement = function(flags) {
  return JSON.stringify(flags);
};

exports.globalSettings = function() {

  var toOutput = {};

  var settingsRelation = miscOps.getParametersArray();

  for (var i = 0; i < settingsRelation.length; i++) {
    var setting = settingsRelation[i];
    toOutput[setting.setting] = settings[setting.setting];
  }

  return JSON.stringify(toOutput);

};

exports.overboard = function(foundThreads, previewRelation, callback,
    multiboard, sfw) {

  var threadsToAdd = [];

  for (var i = 0; i < foundThreads.length; i++) {

    var thread = foundThreads[i];

    var posts = [];

    if (previewRelation[thread.boardUri]) {
      posts = previewRelation[thread.boardUri][thread.threadId];
    }

    threadsToAdd.push(exports.getThreadObject(thread, posts));

  }

  if (multiboard) {
    callback(null, JSON.stringify({
      threads : threadsToAdd
    }));
  } else {
    var url = '/' + (sfw ? sfwOverboard : overboard) + '/1.json';

    gridFsHandler.writeData(JSON.stringify({
      threads : threadsToAdd
    }), url, 'application/json', {}, callback);
  }

};

exports.log = function(date, logs, callback) {

  var path = '/.global/logs/';
  path += logger.formatedDate(date) + '.json';

  gridFsHandler.writeData(JSON.stringify(logs), path, 'application/json', {
    type : 'log'
  }, callback);

};

exports.graphs = function(dates) {
  return JSON.stringify(dates);
};

exports.mediaManagement = function(media, pages) {

  return JSON.stringify({
    pages : pages,
    media : media
  });

};

exports.languages = function(languages) {
  return JSON.stringify(languages);
};

exports.accounts = function(accounts) {
  return JSON.stringify(accounts);
};

exports.accountManagement = function(accountData) {
  return JSON.stringify(accountData);
};
