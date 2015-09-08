'use strict';

// builds static JSON
// json counterpart of domManipulator

var settings = require('../boot').getGeneralSettings();
var gridFsHandler;
var miscOps;

var boardCreationRequirement = settings.boardCreationRequirement;

exports.loadDependencies = function() {

  miscOps = require('../engine/miscOps');
  gridFsHandler = require('./gridFsHandler');

};

// start of shared functions
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
        name : file.name,
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
    toReturn.range = miscOps.getRange(post.ip).join('.');
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
    threadId : thread.threadId,
    flag : thread.flag,
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
    files : exports.getFilesArray(thread.files, modding),
    posts : exports.buildThreadPosts(posts, board, modding, userRole)
  };

  if (modding && thread.ip) {
    threadObject.ip = miscOps.hashIpForDisplay(thread.ip, board.ipSalt,
        userRole);
    threadObject.range = miscOps.getRange(thread.ip).join('.');
  }

  return threadObject;
};
// end of shared functions

exports.thread = function(boardUri, boardData, threadData, posts, callback,
    modding, userRole) {

  var threadObject = exports.getThreadObject(threadData, posts, boardData,
      modding, userRole);

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

exports.frontPage = function(boards, callback) {

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

  gridFsHandler.writeData(JSON.stringify({
    topBoards : topBoards
  }), '/index.json', 'application/json', {}, callback);

};

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

  gridFsHandler.writeData(JSON.stringify({
    pageCount : pageCount,
    boardName : boardData.boardName,
    boardDescription : boardData.boardDescription,
    settings : boardData.settings,
    threads : threadsToAdd
  }), ownName, 'application/json', {
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
      cyclic : thread.cyclic ? true : false
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
    boardCreationAllowed : allowed
  });

};

exports.globalManagement = function(userRole, userLogin, staff, reports) {

  return JSON.stringify({
    login : userLogin,
    globalRole : isNaN(userRole) ? 4 : userRole,
    staff : staff || [],
    reports : reports || []
  });

};

exports.boardManagement = function(userData, boardData, reports) {

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
    openReports : reports || reports
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

exports.logs = function(logs, pageCount) {

  return JSON.stringify({
    pageCount : pageCount,
    logs : logs
  });

};

exports.filterManagement = function(filters) {

  return JSON.stringify(filters);

};

exports.boardModeration = function(ownerData) {

  return JSON.stringify({
    owner : ownerData.login
  });

};

exports.boards = function(pageCount, boards) {

  return JSON.stringify({
    pageCount : pageCount,
    boards : boards
  });

};

exports.rangeBans = function(rangeBans) {

  for (var i = 0; i < rangeBans.length; i++) {
    rangeBans[i].range = rangeBans[i].range.join('.');
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

exports.globalSettings = function(globalSettings) {

  return JSON.stringify({
    address : globalSettings.address,
    port : globalSettings.port,
    autoSageLimit : globalSettings.autoSageLimit,
    tempDirectory : globalSettings.tempDirectory,
    emailSender : globalSettings.emailSender,
    siteTitle : globalSettings.siteTitle,
    maxRequestSizeMB : globalSettings.maxRequestSizeMB,
    maxBoardTags : globalSettings.maxBoardTags,
    verbose : globalSettings.verbose,
    disableFloodCheck : globalSettings.disableFloodCheck,
    mediaThumb : globalSettings.mediaThumb,
    serveArchive : globalSettings.serveArchive,
    fePath : globalSettings.fePath,
    pageSize : globalSettings.pageSize,
    latestPostCount : globalSettings.latestPostCount,
    maxFiles : globalSettings.maxFiles,
    maxThreadCount : globalSettings.maxThreadCount,
    captchaExpiration : globalSettings.captchaExpiration,
    maxFileSizeMB : globalSettings.maxFileSizeMB,
    acceptedMimes : globalSettings.acceptedMimes,
    logPageSize : globalSettings.logPageSize,
    topBoardsCount : globalSettings.topBoardsCount,
    boardsPerPage : globalSettings.boardsPerPage,
    torSource : globalSettings.torSource,
    maxBoardRules : globalSettings.maxBoardRules,
    thumbSize : globalSettings.thumbSize,
    maxFilters : globalSettings.maxFilters,
    maxBoardVolunteers : globalSettings.maxBoardVolunteers,
    maxBannerSizeKB : globalSettings.maxBannerSizeKB,
    maxFlagSizeKB : globalSettings.maxFlagSizeKB,
    floodTimerSec : globalSettings.floodTimerSec,
    archiveLevel : globalSettings.archiveLevel,
    captchaFonts : globalSettings.captchaFonts,
    torAccess : globalSettings.torAccess,
    proxyAccess : globalSettings.proxyAccess,
    clearIpMinRole : globalSettings.clearIpMinRole,
    thumbExtension : globalSettings.thumbExtension,
    disableTopBoards : globalSettings.disableTopBoards,
    allowGlobalBoardModeration : globalSettings.allowGlobalBoardModeration,
    boardCreationRequirement : globalSettings.boardCreationRequirement,
    addons : globalSettings.addons
  });

};