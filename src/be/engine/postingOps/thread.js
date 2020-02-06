'use strict';

// handles creation of new threads

var crypto = require('crypto');
var db = require('../../db');
var threads = db.threads();
var boards = db.boards();
var logger = require('../../logger');
var common;
var delOps;
var formOps;
var overboardOps;
var uploadHandler;
var lang;
var r9k;
var miscOps;
var captchaOps;
var overboard;
var threadLimit;
var unboundBoardSettings;
var globalLatestPosts;
var sfwOverboard;

exports.loadSettings = function() {

  var settings = require('../../settingsHandler').getGeneralSettings();

  unboundBoardSettings = settings.unboundBoardLimits;
  sfwOverboard = settings.sfwOverboard;
  overboard = settings.overboard;
  threadLimit = settings.maxThreadCount;
  globalLatestPosts = settings.globalLatestPosts;

};

exports.loadDependencies = function() {

  common = require('.').common;
  formOps = require('../formOps');
  delOps = require('../deletionOps').miscDeletions;
  uploadHandler = require('../uploadHandler');
  lang = require('../langOps').languagePack;
  overboardOps = require('../overboardOps');
  miscOps = require('../miscOps');
  captchaOps = require('../captchaOps');
  r9k = require('../r9k');

};

exports.addThreadToLatestPosts = function(omitted, thread, threadId, callback) {

  if (omitted || !globalLatestPosts) {
    callback(null, threadId);
  } else {

    common.addPostToLatestPosts(thread, function addedToLatest(error) {

      if (error) {
        console.log(error);
      }

      callback(null, threadId);

    });
  }
};

exports.finishThreadCreation = function(boardData, threadId, enabledCaptcha,
    callback, thread) {

  if (enabledCaptcha) {
    process.send({
      board : boardData.boardUri,
      buildAll : true
    });
  } else {

    // signal rebuild of board pages
    process.send({
      board : boardData.boardUri
    });
  }

  process.send({
    multiboard : true,
    board : boardData.boardUri
  });

  var omitted = miscOps.omitted(boardData);

  if (!omitted && (overboard || sfwOverboard)) {
    overboardOps.reaggregate({
      overboard : true,
      _id : thread._id,
      sfw : thread.sfw
    });
  }

  common.addPostToStats(thread.ip, boardData.boardUri, function updatedStats(
      error) {

    if (error) {
      console.log(error.toString());
    }

    exports.addThreadToLatestPosts(omitted, thread, threadId, callback);
  });

};

exports.updatePages = function(boardData, threadId, enabledCaptcha, callback,
    thread) {

  common.setThreadsPage(boardData.boardUri, function updatedPages(error) {

    if (error) {
      console.log(error);
    }

    exports.finishThreadCreation(boardData, threadId, enabledCaptcha, callback,
        thread);
  });

};

exports.updateBoardForThreadCreation = function(boardData, threadId,
    enabledCaptcha, language, callback, thread) {

  var boardUri = boardData.boardUri;
  var boardThreadLimit = boardData.maxThreadCount;

  var boardLimit = boardThreadLimit && boardThreadLimit < threadLimit;
  boardLimit = boardLimit || (boardThreadLimit && unboundBoardSettings);

  var limitToUse = boardLimit ? boardThreadLimit : threadLimit;

  boards.findOneAndUpdate({
    boardUri : boardUri
  }, {
    $inc : {
      threadCount : 1
    }
  }, {
    returnOriginal : false
  }, function updatedBoard(error, board) {
    if (error) {
      callback(error);
    } else {

      var threadCount = board.value.threadCount;

      if (threadCount > limitToUse) {

        // style exception, too simple
        delOps.cleanThreads(boardUri,
            boardData.settings.indexOf('early404') > -1, limitToUse, language,
            function cleanedThreads(error) {
              if (error) {
                callback(error);
              } else {
                exports.updatePages(boardData, threadId, enabledCaptcha,
                    callback, thread);
              }
            });
        // style exception, too simple

      } else {
        exports.updatePages(boardData, threadId, enabledCaptcha, callback,
            thread);
      }

    }
  });
};

exports.updateLatest = function(boardData, enabledCaptcha, language, callback,
    thread) {

  uploadHandler.updateLatestImages(boardData, thread.threadId, null,
      thread.files, function(error) {

        if (error) {
          callback(error);
        } else {
          exports.updateBoardForThreadCreation(boardData, thread.threadId,
              enabledCaptcha, language, callback, thread);
        }

      });

};

exports.getNewThread = function(req, userData, parameters, board, threadId,
    wishesToSign) {

  var salt = crypto.createHash('sha256').update(
      threadId + parameters.toString() + Math.random() + new Date()).digest(
      'hex');

  var ip = logger.ip(req);

  var id = board.settings.indexOf('disableIds') > -1 ? null : common.createId(
      salt, parameters.boardUri, ip);

  var nameToUse = parameters.name || board.anonymousName;
  nameToUse = nameToUse || common.defaultAnonymousName;

  var threadToAdd = {
    boardUri : parameters.boardUri,
    threadId : threadId,
    salt : salt,
    hash : parameters.hash,
    ip : ip,
    bypassId : req.bypassId,
    id : id,
    asn : req.asn,
    markdown : parameters.markdown,
    lastBump : new Date(),
    creation : parameters.creationDate,
    subject : parameters.subject,
    pinned : false,
    locked : false,
    signedRole : common.getSignedRole(userData, wishesToSign, board),
    name : nameToUse,
    message : parameters.message,
    email : parameters.email
  };

  if (board.specialSettings && board.specialSettings.indexOf('sfw') > -1) {
    threadToAdd.sfw = true;
  }

  if (parameters.flag) {
    threadToAdd.flagName = parameters.flagName;
    threadToAdd.flag = parameters.flag;
    threadToAdd.flagCode = parameters.flagCode;
  }

  if (parameters.password) {
    threadToAdd.password = parameters.password;
  }

  return threadToAdd;

};

exports.createThread = function(req, userData, parameters, newFiles, board,
    threadId, wishesToSign, enabledCaptcha, callback) {

  var threadToAdd = exports.getNewThread(req, userData, parameters, board,
      threadId, wishesToSign);

  if (newFiles.length) {
    threadToAdd.files = uploadHandler.handleSpoilers(board, parameters.spoiler,
        newFiles);
  }

  threads.insertOne(threadToAdd, function createdThread(error) {

    if (error && error.code === 11000) {

      parameters.creationDate = new Date();

      exports.createThread(req, userData, parameters, newFiles, board,
          threadId + 1, wishesToSign, enabledCaptcha, callback);
    } else if (error) {
      callback(error);
    } else {

      common.recordFlood(req, true);

      exports.updateLatest(board, enabledCaptcha, req.language, callback,
          threadToAdd);

    }
  });

};

exports.checkFileErrors = function(parameters, board, req) {

  var boardSettings = board.settings || [];

  var noFiles = !parameters.files.length;
  var textBoard = boardSettings.indexOf('textBoard') > -1;
  var requireFile = boardSettings.indexOf('requireThreadFile') > -1;

  if (textBoard && !noFiles) {
    return lang(req.language).errTextBoard;
  } else if (requireFile && !textBoard && noFiles) {
    return lang(req.language).msgErrThreadFileRequired;
  }

  return common.checkBoardFileLimits(parameters.files, board, req.language);

};

exports.saveUploads = function(req, userData, parameters, board, threadId,
    wishesToSign, enabledCaptcha, callback) {

  var newFiles = [];

  uploadHandler.saveUploads(parameters, newFiles, function savedUploads() {

    exports.createThread(req, userData, parameters, newFiles, board, threadId,
        wishesToSign, enabledCaptcha, callback);

  });

};

exports.handleFiles = function(req, userData, parameters, board, threadId,
    wishesToSign, enabledCaptcha, callback) {

  formOps.validateMimes(parameters, parameters.files, function(error) {

    if (error) {
      return common.recordFloodAndError(req, error, callback, true);
    }

    var fileError = exports.checkFileErrors(parameters, board, req);

    if (fileError) {
      return common.recordFloodAndError(req, fileError, callback, true);
    }

    // style exception, too simple
    r9k.check(parameters, board, req.language, function checked(error) {

      if (error) {
        common.recordFloodAndError(req, error, callback, true);
      } else {
        exports.saveUploads(req, userData, parameters, board, threadId,
            wishesToSign, enabledCaptcha, callback);
      }

    });
    // style exception, too simple

  });

};

exports.resetLock = function(board) {

  if (board.lockedUntil) {
    return true;
  }

  var expiration = new Date(new Date().getTime() - (1000 * 60 * 60));

  return board.lockCountStart <= expiration;

};

exports.setLockReset = function(updateBlock, board, setBlock) {

  updateBlock.$unset = {
    lockedUntil : 1
  };

  board.lockCountStart = null;
  setBlock.threadLockCount = 1;

};

exports.setUpdateForHourlyLimit = function(updateBlock, board) {

  var usedSet = false;

  var setBlock = {};

  if (exports.resetLock(board)) {
    usedSet = true;
    exports.setLockReset(updateBlock, board, setBlock);

  } else {
    updateBlock.$inc.threadLockCount = 1;

    if (board.threadLockCount >= board.hourlyThreadLimit - 1) {
      var lockExpiration = new Date(new Date().getTime() + (1000 * 60 * 60));
      usedSet = true;
      setBlock.lockedUntil = lockExpiration;
    }

  }

  if (!board.lockCountStart) {
    usedSet = true;
    setBlock.lockCountStart = new Date();
  }

  if (usedSet) {
    updateBlock.$set = setBlock;
  }
};

exports.setAutoCaptchaReset = function(board, setBlock) {

  board.autoCaptchaStartTime = null;
  board.autoCaptchaCount = 0;

  setBlock.autoCaptchaCount = 1;

  return true;
};

exports.setStartTime = function(usedSet, board, setBlock, updateBlock) {
  if (!board.autoCaptchaStartTime) {
    usedSet = true;
    setBlock.autoCaptchaStartTime = new Date();
  }

  if (usedSet) {
    updateBlock.$set = setBlock;
  }
};

exports.setCaptchaEnabling = function(updateBlock) {

  var unsetBlock = updateBlock.$unset || {};

  unsetBlock.autoCaptchaCount = 1;
  unsetBlock.autoCaptchaStartTime = 1;

  updateBlock.$unset = unsetBlock;

  delete updateBlock.$inc.autoCaptchaCount;

  if (updateBlock.$set) {
    delete updateBlock.$set.autoCaptchaStartTime;
    delete updateBlock.$set.autoCaptchaCount;
  } else {
    updateBlock.$set = {};
  }

  updateBlock.$set.captchaMode = 1;

  return true;
};

exports.setUpdateForAutoCaptcha = function(updateBlock, board) {

  if (board.captchaMode) {
    return;
  }

  var expiration = new Date(new Date().getTime() - (1000 * 60 * 60));

  var setBlock = updateBlock.$set;
  var usedSet = false;

  if (setBlock) {
    usedSet = true;

  } else {
    setBlock = {};
  }

  if (board.autoCaptchaStartTime <= expiration) {

    usedSet = exports.setAutoCaptchaReset(board, setBlock);

  } else {
    updateBlock.$inc.autoCaptchaCount = 1;
  }

  exports.setStartTime(usedSet, board, setBlock, updateBlock);

  if (board.autoCaptchaCount >= board.autoCaptchaThreshold - 1) {
    return exports.setCaptchaEnabling(updateBlock);
  }
};

exports.getNewThreadId = function(req, userData, parameters, board,
    wishesToSign, callback) {

  var updateBlock = {
    $inc : {
      lastPostId : 1
    }
  };

  if (board.hourlyThreadLimit) {
    exports.setUpdateForHourlyLimit(updateBlock, board);
  }

  var enabledCaptcha;

  if (board.autoCaptchaThreshold) {
    enabledCaptcha = exports.setUpdateForAutoCaptcha(updateBlock, board);
  }

  boards.findOneAndUpdate({
    boardUri : parameters.boardUri
  }, updateBlock, {
    returnOriginal : false
  }, function gotLastIdInfo(error, lastIdData) {
    if (error) {
      callback(error);
    } else {

      parameters.creationDate = new Date();

      // style exception, too simple
      common.getFlagUrl(parameters.flag, logger.ip(req), board,
          parameters.noFlag, function gotFlagUrl(flagUrl, flagName, flagCode) {

            parameters.flagCode = flagCode;
            parameters.flagName = flagName;
            parameters.flag = flagUrl;

            exports.handleFiles(req, userData, parameters, board,
                lastIdData.value.lastPostId, wishesToSign, enabledCaptcha,
                callback);
          });
      // style exception, too simple

    }
  });
};

exports.checkMarkdownForThread = function(req, userData, parameters, board,
    callback) {

  common.markdownText(parameters.message, parameters.boardUri, board.settings
      .indexOf('allowCode') > -1, function gotMarkdown(error, markdown) {
    if (error) {
      callback(error);
    } else {
      parameters.markdown = markdown;
      var wishesToSign = common.doesUserWishesToSign(userData, parameters);

      // style exception, too simple
      common.checkForTripcode(parameters, function setTripCode(error,
          parameters) {
        if (error) {
          callback(error);
        } else {
          exports.getNewThreadId(req, userData, parameters, board,
              wishesToSign, callback);
        }
      });
      // style exception, too simple

    }
  });

};

exports.checkFileLimit = function(req, userData, parameters, board, callback) {

  common.checkFileLimit(req, parameters, function checked(error) {

    if (error) {
      callback(error);
    } else {
      exports
          .checkMarkdownForThread(req, userData, parameters, board, callback);
    }

  });

};

exports.cleanParameters = function(board, parameters, captchaId, req, cb,
    userData) {

  if (board.settings.indexOf('forceAnonymity') > -1) {
    parameters.name = null;
  }

  miscOps.sanitizeStrings(parameters, common.postingParameters);

  common.applyFilters(board.filters, parameters.message, function(error,
      newMessage) {

    if (error) {
      return cb(error);
    }

    parameters.message = newMessage;

    // style exception, too simple
    captchaOps.attemptCaptcha(captchaId, parameters.captcha, board,
        req.language, function solvedCaptcha(error) {
          if (error) {
            cb(error);
          } else {
            exports.checkFileLimit(req, userData, parameters, board, cb);
          }
        });
    // style exception, too simple

  });

};

exports.newThread = function(req, userData, parameters, captchaId, cb) {

  parameters.hash = r9k.getMessageHash(parameters.message);
  parameters.boardUri = parameters.boardUri.toString();

  boards.findOne({
    boardUri : parameters.boardUri
  }, {
    projection : {
      _id : 0,
      owner : 1,
      volunteers : 1,
      boardUri : 1,
      autoCaptchaThreshold : 1,
      autoCaptchaCount : 1,
      autoCaptchaStartTime : 1,
      hourlyThreadLimit : 1,
      maxFiles : 1,
      locationFlagMode : 1,
      maxFileSizeMB : 1,
      usesCustomSpoiler : 1,
      specialSettings : 1,
      maxThreadCount : 1,
      captchaMode : 1,
      lockedUntil : 1,
      acceptedMimes : 1,
      lockCountStart : 1,
      filters : 1,
      threadLockCount : 1,
      anonymousName : 1,
      settings : 1
    }
  }, function gotBoard(error, board) {

    var locked = board && board.specialSettings;
    locked = locked && board.specialSettings.indexOf('locked') > -1;

    if (error) {
      cb(error);
    } else if (!board) {
      cb(lang(req.language).errBoardNotFound);
    } else if (board.lockedUntil > new Date()) {
      cb(lang(req.language).errBoardLocked);
    } else if (locked) {
      cb(lang(req.language).errLockedBoard);
    } else {
      exports.cleanParameters(board, parameters, captchaId, req, cb, userData);
    }
  });

};
