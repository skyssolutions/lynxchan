'use strict';

// handles replies to threads

var db = require('../../db');
var boards = db.boards();
var posts = db.posts();
var reports = db.reports();
var threads = db.threads();
var logger = require('../../logger');
var common;
var overboardOps;
var formOps;
var referenceHandler;
var r9k;
var uploadHandler;
var lang;
var unboundBoardSettings;
var miscOps;
var captchaOps;
var overboard;
var taskHandler = require('../../taskListener');
var wsEnabled;
var sfwOverboard;
var pageLimit;
var bumpLimit;
var latestPostsCount;
var pinnedLatest;
var globalLatestPosts;

exports.loadSettings = function() {

  var settings = require('../../settingsHandler').getGeneralSettings();

  wsEnabled = settings.wsPort || settings.wssPort;
  pinnedLatest = settings.latestPostPinned;
  unboundBoardSettings = settings.unboundBoardLimits;
  sfwOverboard = settings.sfwOverboard;
  overboard = settings.overboard;
  bumpLimit = settings.autoSageLimit;
  latestPostsCount = settings.latestPostCount;
  globalLatestPosts = settings.globalLatestPosts;
  pageLimit = Math.ceil(settings.maxThreadCount / settings.pageSize);

};

exports.loadDependencies = function() {

  common = require('.').common;
  formOps = require('../formOps');
  overboardOps = require('../overboardOps');
  referenceHandler = require('../mediaHandler');
  r9k = require('../r9k');
  uploadHandler = require('../uploadHandler');
  lang = require('../langOps').languagePack;
  miscOps = require('../miscOps');
  captchaOps = require('../captchaOps');

};

exports.reaggregateThread = function(boardUri, threadId, postId, callback) {

  posts.aggregate([ {
    $match : {
      boardUri : boardUri,
      threadId : threadId
    }
  }, {
    $group : {
      _id : 0,
      postCount : {
        $sum : 1
      },
      fileCount : {
        $sum : {
          $size : {
            $ifNull : [ '$files', [] ]
          }
        }
      }
    }
  } ]).toArray(function aggregated(error, results) {

    if (error) {
      callback(error);
    } else {

      var data = results.length ? results[0] : {
        postCount : 0,
        fileCount : 0
      };

      // style exception, too simple
      threads.updateOne({
        threadId : threadId,
        boardUri : boardUri
      }, {
        $set : {
          postCount : data.postCount,
          fileCount : data.fileCount
        }
      }, function updatedThread(error) {
        callback(error, postId);
      });
      // style exception, too simple

    }

  });

};

exports.removeCleanedPostsReports = function(postsToDelete, boardUri, threadId,
    postId, callback) {

  reports.deleteMany({
    boardUri : boardUri,
    postId : {
      $in : postsToDelete
    }
  }, function deletedReports(error) {

    if (error) {
      callback(error);
    } else {
      exports.reaggregateThread(boardUri, threadId, postId, callback);
    }

  });

};

exports.removeCleanedPosts = function(postsToDelete, boardUri, threadId,
    postId, removedFileCount, callback) {

  posts.deleteMany({
    boardUri : boardUri,
    postId : {
      $in : postsToDelete
    }
  }, function postsRemoved(error) {
    if (error) {
      callback(error);
    } else {

      exports.removeCleanedPostsReports(postsToDelete, boardUri, threadId,
          postId, callback);

    }
  });

};

exports.cleanThreadPosts = function(boardUri, threadId, postId, language,
    callback) {

  posts.aggregate([ {
    $match : {
      boardUri : boardUri,
      threadId : threadId
    }
  }, {
    $sort : {
      creation : -1
    }
  }, {
    $skip : bumpLimit
  }, {
    $group : {
      _id : 0,
      posts : {
        $push : '$postId'
      },
      removedFileCount : {
        $sum : {
          $size : {
            $ifNull : [ '$files', [] ]
          }
        }
      }
    }
  } ]).toArray(
      function gotPosts(error, results) {
        if (error) {
          return callback(error);
        } else if (!results.length) {
          return callback(null, postId);
        }

        var postsToDelete = results[0].posts;
        var removedFileCount = results[0].removedFileCount;

        // style exception, too simple
        referenceHandler.clearPostingReferences(boardUri, null, postsToDelete,
            false, false, null, language, function removedReferences(error) {

              if (error) {
                callback(error);
              } else {
                exports.removeCleanedPosts(postsToDelete, boardUri, threadId,
                    postId, removedFileCount, callback);
              }

            });
        // style exception, too simple

      });

};

exports.updateBoardForPostCreation = function(ip, parameters, postId, thread,
    cleanPosts, bump, language, enabledCaptcha, callback) {

  if (enabledCaptcha) {
    process.send({
      board : parameters.boardUri,
      buildAll : true
    });

  } else {

    process.send({
      board : parameters.boardUri,
      thread : parameters.threadId
    });

    process.send({
      board : parameters.boardUri,
      catalog : true
    });

    process.send({
      multiboard : true,
      board : parameters.boardUri
    });

    if (bump) {

      for (var i = 0; i < (thread.page || 1) && i < pageLimit; i++) {

        // signal rebuild of board pages
        process.send({
          board : parameters.boardUri,
          page : i + 1
        });
      }
    } else if (thread.page) {
      process.send({
        board : parameters.boardUri,
        page : thread.page
      });
    }

  }

  common.addPostToStats(ip, parameters.boardUri, function updatedStats(error) {
    if (error) {
      console.log(error.toString());
    }

    if (cleanPosts) {
      exports.cleanThreadPosts(parameters.boardUri, parameters.threadId,
          postId, language, callback);
    } else {
      callback(null, postId);
    }

  });

};

exports.addPostToGlobalLatest = function(omitted, post, thread, parameters,
    cleanPosts, bump, language, enabledCaptcha, callback) {

  if (!omitted && (overboard || sfwOverboard)) {
    overboardOps.reaggregate({
      overboard : true,
      _id : thread._id,
      post : true,
      bump : bump,
      sfw : thread.sfw
    });
  }

  if (omitted || !globalLatestPosts || !post.message) {
    exports.updateBoardForPostCreation(post.ip, parameters, post.postId,
        thread, cleanPosts, bump, language, enabledCaptcha, callback);

  } else {

    common.addPostToLatestPosts(post, function addedToLatestPosts(error) {
      if (error) {
        console.log(error);
      }

      exports.updateBoardForPostCreation(post.ip, parameters, post.postId,
          thread, cleanPosts, bump, language, enabledCaptcha, callback);

    });
  }
};

exports.getBumpLimit = function(boardData) {

  var boardLimit = boardData.autoSageLimit;

  var hasBoardLimit = boardLimit && boardLimit < bumpLimit;

  hasBoardLimit = hasBoardLimit || (boardLimit && unboundBoardSettings);

  return hasBoardLimit ? boardLimit : bumpLimit;

};

exports.setUpdateBlockForAutoSage = function(updateBlock) {

  updateBlock.$set.autoSage = true;

  updateBlock.$unset = miscOps.individualCaches;

};

exports.getSetBlock = function(thread, post) {

  var latestPosts = thread.latestPosts || [];

  latestPosts.push(post.postId);

  latestPosts = latestPosts.sort(function compareNumbers(a, b) {
    return a - b;
  });

  var newOmittedPosts = false;

  if (latestPosts.length > latestPostsCount) {
    newOmittedPosts = true;
    latestPosts.splice(0, latestPosts.length - latestPostsCount);
  } else {
    newOmittedPosts = thread.pinned && latestPosts.length > pinnedLatest;
  }

  var updateBlock = {
    $set : {
      latestPosts : latestPosts
    },
    $inc : {
      postCount : 1,
      fileCount : post.files ? post.files.length : 0
    }
  };

  if (newOmittedPosts) {
    updateBlock.$unset = {
      outerCache : 1,
      outerHashedCache : 1,
      outerClearCache : 1,
      alternativeCaches : 1
    };
  }

  return updateBlock;

};

exports.youngEnoughToBump = function(boardData, thread) {

  if (!boardData.maxBumpAgeDays || thread.cyclic) {
    return true;
  }

  var date = new Date();

  date.setUTCDate(date.getUTCDate() - boardData.maxBumpAgeDays);

  return thread.creation > date;

};

exports.updateThread = function(boardData, parameters, thread, language,
    enabledCaptcha, callback, post) {

  var updateBlock = exports.getSetBlock(thread, post);

  var cleanPosts = false;
  var saged = parameters.email === 'sage';
  var bump = false;

  var limitToUse = exports.getBumpLimit(boardData);

  if (!thread.autoSage) {

    if (thread.postCount >= limitToUse) {

      if (thread.cyclic) {
        cleanPosts = true;
        bump = !saged;
      } else {
        exports.setUpdateBlockForAutoSage(updateBlock);
      }

    } else {
      bump = !saged && exports.youngEnoughToBump(boardData, thread);
    }

  }

  if (bump) {
    updateBlock.$set.lastBump = new Date();
  }

  threads.updateOne({
    boardUri : parameters.boardUri,
    threadId : parameters.threadId
  }, updateBlock, function updatedThread(error, result) {
    if (error) {
      callback(error);
    } else {

      var omitted = miscOps.omitted(boardData);

      if (bump) {

        common.setThreadsPage(parameters.boardUri, function setPages(error) {
          if (error) {
            console.log(error);
          }

          exports.addPostToGlobalLatest(omitted, post, thread, parameters,
              cleanPosts, bump, language, enabledCaptcha, callback);

        });

      } else {
        exports.addPostToGlobalLatest(omitted, post, thread, parameters,
            cleanPosts, bump, language, enabledCaptcha, callback);
      }

    }

  });

};

exports.updateLatest = function(boardData, parameters, thread, language,
    enabledCaptcha, callback, post) {

  uploadHandler.updateLatestImages(boardData, post.threadId, post.postId,
      post.files, function(error) {

        if (error) {
          callback(error);
        } else {
          exports.updateThread(boardData, parameters, thread, language,
              enabledCaptcha, callback, post);
        }

      });

};

exports.getNewPost = function(req, parameters, userData, postId, thread, board,
    wishesToSign) {

  var ip = logger.ip(req);

  var hideId = board.settings.indexOf('disableIds') > -1;

  var id = hideId ? null : common
      .createId(thread.salt, parameters.boardUri, ip);

  var nameToUse = parameters.name || board.anonymousName;
  nameToUse = nameToUse || common.defaultAnonymousName;

  var postToAdd = {
    boardUri : parameters.boardUri,
    postId : postId,
    hash : parameters.hash,
    markdown : parameters.markdown,
    ip : ip,
    asn : req.asn,
    threadId : parameters.threadId,
    signedRole : common.getSignedRole(userData, wishesToSign, board),
    creation : parameters.creationDate,
    subject : parameters.subject,
    name : nameToUse,
    id : id,
    bypassId : req.bypassId,
    message : parameters.message,
    email : parameters.email
  };

  if (parameters.flag) {
    postToAdd.flagName = parameters.flagName;
    postToAdd.flagCode = parameters.flagCode;
    postToAdd.flag = parameters.flag;
  }

  if (parameters.password) {
    postToAdd.password = parameters.password;
  }

  return postToAdd;

};

exports.createPost = function(req, parameters, newFiles, userData, postId,
    thread, board, wishesToSign, enabledCaptcha, cb) {

  var postToAdd = exports.getNewPost(req, parameters, userData, postId, thread,
      board, wishesToSign);

  if (newFiles.length) {
    postToAdd.files = uploadHandler.handleSpoilers(board, parameters.spoiler,
        newFiles);
  }

  posts.insertOne(postToAdd, function createdPost(error) {
    if (error && error.code !== 11000) {
      cb(error);
    } else if (error) {
      parameters.creationDate = new Date();

      exports.createPost(req, parameters, userData, postId + 1, thread, board,
          wishesToSign, enabledCaptcha, cb);
    } else {

      if (wsEnabled) {

        taskHandler.sendToSocket(null, {
          type : 'notifySockets',
          threadId : postToAdd.threadId,
          boardUri : postToAdd.boardUri,
          target : [ postId ],
          action : 'post'
        });

      }

      common.recordFlood(req);

      exports.updateLatest(board, parameters, thread, req.language,
          enabledCaptcha, cb, postToAdd);

    }
  });

};

exports.checkFileErrors = function(parameters, board, req) {

  var noFiles = !parameters.files.length;
  var textBoard = (board.settings || []).indexOf('textBoard') > -1;

  if (textBoard && !noFiles) {
    return lang(req.language).errTextBoard;
  } else if (!parameters.message && noFiles) {
    return lang(req.language).errNoFileAndMessage;
  }

  return common.checkBoardFileLimits(parameters.files, board, req.language);

};

exports.saveUploads = function(req, parameters, userData, postId, thread,
    board, wishesToSign, enabledCaptcha, callback) {

  var newFiles = [];

  uploadHandler.saveUploads(parameters, newFiles, function savedUploads() {

    exports.createPost(req, parameters, newFiles, userData, postId, thread,
        board, wishesToSign, enabledCaptcha, callback);

  });

};

exports.handleFiles = function(req, parameters, userData, postId, thread,
    board, wishesToSign, enabledCaptcha, callback) {

  formOps.validateMimes(parameters, parameters.files, function(error) {

    if (error) {
      return common.recordFloodAndError(req, error, callback);
    }

    var fileError = exports.checkFileErrors(parameters, board, req);

    if (fileError) {
      return common.recordFloodAndError(req, fileError, callback);
    }

    // style exception, too simple
    r9k.check(parameters, board, req.language, function checked(error) {

      if (error) {
        common.recordFloodAndError(req, error, callback);
      } else {
        exports.saveUploads(req, parameters, userData, postId, thread, board,
            wishesToSign, enabledCaptcha, callback);
      }

    });
    // style exception, too simple

  });

};

exports.getPostFlag = function(req, parameters, userData, postId, thread,
    board, wishesToSign, enabledCaptcha, cb) {

  common.getFlagUrl(parameters.flag, logger.ip(req), board, parameters.noFlag,
      function gotFlagUrl(flagUrl, flagName, flagCode) {

        parameters.flagName = flagName;
        parameters.flag = flagUrl;
        parameters.flagCode = flagCode;

        exports.handleFiles(req, parameters, userData, postId, thread, board,
            wishesToSign, enabledCaptcha, cb);
      });

};

exports.setCaptchaEnabling = function(updateBlock) {

  updateBlock.$unset = {
    autoFullCaptchaCount : 1,
    autoFullCaptchaStartTime : 1
  };

  delete updateBlock.$inc.autoFullCaptchaCount;

  updateBlock.$set.captchaMode = 2;

  return true;
};

exports.setBoardCaptchaUpdate = function(board, block) {

  if (!board.autoFullCaptchaThreshold || board.captchaMode === 2) {
    return;
  }

  var expiration = new Date(new Date().getTime() - (1000 * 60 * 60));

  var setBlock = block.$set;

  if (board.autoFullCaptchaStartTime <= expiration) {

    board.autoFullCaptchaStartTime = null;
    board.autoFullCaptchaCount = 0;
    setBlock.autoFullCaptchaCount = 1;
  } else {
    block.$inc.autoFullCaptchaCount = 1;
  }

  var currentCount = board.autoFullCaptchaCount;

  var activate = currentCount >= board.autoFullCaptchaThreshold - 1;

  if (!board.autoFullCaptchaStartTime && !activate) {
    setBlock.autoFullCaptchaStartTime = new Date();
  }

  if (activate) {
    return exports.setCaptchaEnabling(block);
  }

};

exports.getPostMarkdown = function(req, parameters, userData, thread, board,
    wishesToSign, callback) {

  common.markdownText(parameters.message, parameters.boardUri, board.settings
      .indexOf('allowCode') > -1, function gotMarkdown(error, markdown) {

    if (error) {
      callback(error);
    } else {
      parameters.markdown = markdown;

      var updateBlock = {
        $inc : {
          lastPostId : 1
        },
        $set : {}
      };

      var enabledCaptcha = exports.setBoardCaptchaUpdate(board, updateBlock);

      if (!Object.keys(updateBlock.$set).length) {
        delete updateBlock.$set;
      }

      // style exception, too simple
      boards.findOneAndUpdate({
        boardUri : parameters.boardUri
      }, updateBlock, {
        returnOriginal : false
      }, function gotNewId(error, lastIdData) {
        if (error) {
          callback(error);
        } else {

          parameters.creationDate = new Date();

          exports.getPostFlag(req, parameters, userData,
              lastIdData.value.lastPostId, thread, board, wishesToSign,
              enabledCaptcha, callback);
        }
      });
      // style exception, too simple

    }

  });

};

exports.applyFilters = function(req, parameters, userData, thread, board,
    wishesToSign, cb) {

  common.applyFilters(board.filters, parameters.message, function(error,
      newMessage) {

    if (error) {
      return cb(error);
    }

    parameters.message = newMessage;

    exports.getPostMarkdown(req, parameters, userData, thread, board,
        wishesToSign, cb);

  });

};

exports.getThread = function(req, parameters, userData, board, callback) {

  var autoLockLimit = exports.getBumpLimit(board) * 2;

  threads.findOne({
    boardUri : parameters.boardUri,
    threadId : parameters.threadId
  }, {
    projection : {
      _id : 1,
      sfw : 1,
      salt : 1,
      page : 1,
      pinned : 1,
      cyclic : 1,
      locked : 1,
      autoSage : 1,
      creation : 1,
      archived : 1,
      postCount : 1,
      latestPosts : 1
    }
  }, function gotThread(error, thread) {
    if (error) {
      callback(error);
    } else if (!thread) {
      callback(lang(req.language).errThreadNotFound);
    } else if (thread.locked || thread.archived) {
      callback(lang(req.language).errThreadLocked);
    } else if (thread.postCount >= autoLockLimit && !thread.cyclic) {
      callback(lang(req.language).errThreadAutoLocked);
    } else {

      if (board.settings.indexOf('forceAnonymity') > -1) {
        parameters.name = null;
      }

      miscOps.sanitizeStrings(parameters, common.postingParameters);

      parameters.message = parameters.message || '';

      var wishesToSign = common.doesUserWishesToSign(userData, parameters);

      // style exception, too simple
      common.checkForTripcode(parameters, function setTripCode(error,
          parameters) {
        if (error) {
          callback(error);
        } else {
          exports.applyFilters(req, parameters, userData, thread, board,
              wishesToSign, callback);
        }
      });
      // style exception, too simple

    }
  });

};

exports.checkFileLimit = function(req, parameters, userData, board, callback) {

  common.checkFileLimit(req, parameters, function checked(error) {

    if (error) {
      callback(error);
    } else {
      exports.getThread(req, parameters, userData, board, callback);
    }

  });

};

exports.newPost = function(req, userData, parameters, captchaId, callback) {

  parameters.threadId = +parameters.threadId;
  parameters.hash = r9k.getMessageHash(parameters.message);

  parameters.boardUri = parameters.boardUri.toString();

  boards.findOne({
    boardUri : parameters.boardUri
  }, {
    projection : {
      _id : 0,
      filters : 1,
      owner : 1,
      boardUri : 1,
      autoFullCaptchaThreshold : 1,
      autoFullCaptchaCount : 1,
      autoFullCaptchaStartTime : 1,
      usesCustomSpoiler : 1,
      anonymousName : 1,
      specialSettings : 1,
      acceptedMimes : 1,
      maxFiles : 1,
      locationFlagMode : 1,
      maxBumpAgeDays : 1,
      captchaMode : 1,
      autoSageLimit : 1,
      maxFileSizeMB : 1,
      settings : 1,
      volunteers : 1
    }
  }, function gotBoard(error, board) {

    var locked = board && board.specialSettings;
    locked = locked && board.specialSettings.indexOf('locked') > -1;

    if (error) {
      callback(error);
    } else if (!board) {
      callback(lang(req.language).errBoardNotFound);
    } else if (locked) {
      callback(lang(req.language).errLockedBoard);
    } else {

      // style exception, too simple
      captchaOps.attemptCaptcha(captchaId, parameters.captcha, board,
          req.language, function solvedCaptcha(error) {

            if (error) {
              callback(error);
            } else {
              exports
                  .checkFileLimit(req, parameters, userData, board, callback);
            }

          }, true);
      // style exception, too simple

    }
  });

};