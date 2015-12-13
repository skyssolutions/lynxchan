'use strict';

// handles creation of new threads

var crypto = require('crypto');
var db = require('../../db');
var threads = db.threads();
var boards = db.boards();
var debug = require('../../boot').debug();
var settings = require('../../settingsHandler').getGeneralSettings();
var verbose = settings.verbose;
var logger = require('../../logger');
var common;
var delOps;
var generator;
var uploadHandler;
var lang;
var r9k;
var miscOps;
var captchaOps;

var threadLimit = settings.maxThreadCount;
var globalLatestPosts = settings.globalLatestPosts;

exports.loadDependencies = function() {

  common = require('.').common;
  delOps = require('../deletionOps').miscDeletions;
  generator = require('../generator').board;
  uploadHandler = require('../uploadHandler');
  lang = require('../langOps').languagePack();
  miscOps = require('../miscOps');
  captchaOps = require('../captchaOps');
  r9k = require('../r9k');

};

exports.addThreadToLatestPosts = function(thread, threadId, callback) {

  if (!globalLatestPosts) {
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

exports.finishThreadCreation = function(boardUri, threadId, enabledCaptcha,
    callback, thread) {

  if (enabledCaptcha) {
    process.send({
      board : boardUri,
      buildAll : true
    });
  } else {

    // signal rebuild of board pages
    process.send({
      board : boardUri
    });

    // signal rebuild of thread
    process.send({
      board : boardUri,
      thread : threadId
    });
  }

  if (settings.overboard) {
    process.send({
      overboard : true,
      _id : thread._id
    });
  }

  common.addPostToStats(boardUri, function updatedStats(error) {
    if (error) {
      console.log(error.toString());
    }

    // style exception, too simple
    generator.preview(null, null, null, function generatedPreview(error) {
      if (error) {
        console.log(error);
      }

      exports.addThreadToLatestPosts(thread, threadId, callback);
    }, thread);
    // style exception, too simple

  });

};

exports.updateBoardForThreadCreation = function(boardUri, threadId,
    enabledCaptcha, callback, thread) {

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

      if (board.value.threadCount > threadLimit) {

        // style exception, too simple
        delOps.cleanThreads(boardUri, function cleanedThreads(error) {
          if (error) {
            callback(error);
          } else {
            exports.finishThreadCreation(boardUri, threadId, enabledCaptcha,
                callback, thread);
          }
        });
        // style exception, too simple

      } else {
        exports.finishThreadCreation(boardUri, threadId, enabledCaptcha,
            callback, thread);
      }

    }
  });
};

exports.createThread = function(req, userData, parameters, board, threadId,
    wishesToSign, enabledCaptcha, callback) {

  var salt = crypto.createHash('sha256').update(
      threadId + parameters.toString() + Math.random() + new Date()).digest(
      'hex');

  var hideId = board.settings.indexOf('disableIds') > -1;

  var ip = logger.ip(req);

  var id = hideId ? null : common.createId(salt, parameters.boardUri, ip);

  var nameToUse = parameters.name || board.anonymousName;
  nameToUse = nameToUse || common.defaultAnonymousName;

  var threadToAdd = {
    boardUri : parameters.boardUri,
    threadId : threadId,
    salt : salt,
    hash : parameters.hash,
    ip : ip,
    id : id,
    markdown : parameters.markdown,
    lastBump : new Date(),
    creation : new Date(),
    subject : parameters.subject,
    pinned : false,
    locked : false,
    signedRole : common.getSignedRole(userData, wishesToSign, board),
    name : nameToUse,
    message : parameters.message,
    email : parameters.email
  };

  if (req.isProxy) {
    threadToAdd.proxyIp = logger.ip(req, true);
  }

  if (parameters.flag) {
    threadToAdd.flagName = parameters.flagName;
    threadToAdd.flag = parameters.flag;
  }

  if (parameters.password) {
    threadToAdd.password = parameters.password;
  }

  threads.insertOne(threadToAdd, function createdThread(error) {
    if (error && error.code === 11000) {
      exports.createThread(req, userData, parameters, board, threadId + 1,
          wishesToSign, enabledCaptcha, callback);
    } else if (error) {
      callback(error);
    } else {

      common.recordFlood(req);

      // style exception, too simple
      uploadHandler.saveUploads(board, threadId, null, parameters,
          function savedUploads(error) {
            if (error) {
              if (verbose) {
                console.log(error);
              }

              if (debug) {
                throw error;
              }
            }

            exports.updateBoardForThreadCreation(parameters.boardUri, threadId,
                enabledCaptcha, callback, threadToAdd);

          });
      // style exception, too simple

    }
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
  board.threadLockCount = 0;

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

  }

  if (!board.lockCountStart) {
    usedSet = true;
    setBlock.lockCountStart = new Date();
  }

  if (board.threadLockCount >= board.hourlyThreadLimit - 1) {
    var lockExpiration = new Date(new Date().getTime() + (1000 * 60 * 60));
    usedSet = true;
    setBlock.lockedUntil = lockExpiration;
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

  updateBlock.$pullAll = {
    settings : [ 'disableCaptcha' ]
  };

  var unsetBlock = updateBlock.$unset || {};

  unsetBlock.autoCaptchaCount = 1;
  unsetBlock.autoCaptchaStartTime = 1;

  updateBlock.$unset = unsetBlock;

  delete updateBlock.$inc.autoCaptchaCount;

  if (updateBlock.$set) {
    delete updateBlock.$set.autoCaptchaStartTime;
    delete updateBlock.$set.autoCaptchaCount;
  }

  return true;
};

exports.setUpdateForAutoCaptcha = function(updateBlock, board) {

  if (board.settings.indexOf('disableCaptcha') === -1) {
    return false;
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

      // style exception, too simple
      common.getFlagUrl(parameters.flag, parameters.boardUri,
          function gotFlagUrl(flagUrl, flagName) {

            parameters.flagName = flagName;
            parameters.flag = flagUrl;

            exports.createThread(req, userData, parameters, board,
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

exports.checkR9K = function(req, userData, parameters, board, callback) {

  r9k.check(parameters, board, function checked(error) {

    if (error) {
      callback(error);
    } else {
      exports
          .checkMarkdownForThread(req, userData, parameters, board, callback);
    }

  });

};

exports.newThread = function(req, userData, parameters, captchaId, cb) {

  var noFiles = !parameters.files.length;

  parameters.hash = r9k.getMessageHash(parameters.message);

  boards.findOne({
    boardUri : parameters.boardUri
  }, {
    _id : 0,
    owner : 1,
    volunteers : 1,
    boardUri : 1,
    autoCaptchaThreshold : 1,
    autoCaptchaCount : 1,
    autoCaptchaStartTime : 1,
    hourlyThreadLimit : 1,
    usesCustomSpoiler : 1,
    lockedUntil : 1,
    lockCountStart : 1,
    filters : 1,
    threadLockCount : 1,
    anonymousName : 1,
    settings : 1
  }, function gotBoard(error, board) {
    if (error) {
      cb(error);
    } else if (!board) {
      cb(lang.errBoardNotFound);
    } else if (board.lockedUntil > new Date()) {
      cb(lang.errBoardLocked);
    } else if (board.settings.indexOf('requireThreadFile') > -1 && noFiles) {
      cb(lang.msgErrThreadFileRequired);
    } else {

      if (board.settings.indexOf('forceAnonymity') > -1) {
        parameters.name = null;
      }

      miscOps.sanitizeStrings(parameters, common.postingParameters);

      parameters.message = common.applyFilters(board.filters,
          parameters.message);

      // style exception, too simple
      captchaOps.attemptCaptcha(captchaId, parameters.captcha, board,
          function solvedCaptcha(error) {
            if (error) {
              cb(error);
            } else {
              exports.checkR9K(req, userData, parameters, board, cb);
            }
          });
      // style exception, too simple

    }
  });

};
