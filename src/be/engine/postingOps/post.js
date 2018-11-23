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
var referenceHandler;
var r9k;
var uploadHandler;
var lang;
var miscOps;
var captchaOps;
var overboard;
var sfwOverboard;
var pageLimit;
var autoLockLimit;
var bumpLimit;
var latestPostsCount;
var globalLatestPosts;

exports.loadSettings = function() {

  var settings = require('../../settingsHandler').getGeneralSettings();

  sfwOverboard = settings.sfwOverboard;
  overboard = settings.overboard;
  bumpLimit = settings.autoSageLimit;
  latestPostsCount = settings.latestPostCount;
  globalLatestPosts = settings.globalLatestPosts;
  autoLockLimit = bumpLimit * 2;
  pageLimit = Math.ceil(settings.maxThreadCount / settings.pageSize);

};

exports.loadDependencies = function() {

  common = require('.').common;
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

        if (error) {
          callback(error);
        } else {
          callback(null, postId);
        }

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
          callback(error);
        } else if (!results.length) {
          callback(null, postId);
        } else {

          var postsToDelete = results[0].posts;
          var removedFileCount = results[0].removedFileCount;

          // style exception, too simple
          referenceHandler.clearPostingReferences(boardUri, null,
              postsToDelete, false, false, null, language,
              function removedReferences(error) {

                if (error) {
                  callback(error);
                } else {
                  exports.removeCleanedPosts(postsToDelete, boardUri, threadId,
                      postId, removedFileCount, callback);
                }

              });
          // style exception, too simple

        }

      });

};

exports.updateBoardForPostCreation = function(ip, parameters, postId, thread,
    cleanPosts, bump, language, callback) {

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
    cleanPosts, bump, language, callback) {

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
        thread, cleanPosts, bump, language, callback);

  } else {

    common.addPostToLatestPosts(post, function addedToLatestPosts(error) {
      if (error) {
        console.log(error);
      }

      exports.updateBoardForPostCreation(post.ip, parameters, post.postId,
          thread, cleanPosts, bump, language, callback);

    });
  }
};

exports.getBumpLimit = function(boardData) {

  // No need to check if the number here is greater than 0, since it will be
  // used just to check a condition
  var hasBoardLimit = boardData.autoSageLimit;
  hasBoardLimit = hasBoardLimit && boardData.autoSageLimit < bumpLimit;

  return hasBoardLimit ? boardData.autoSageLimit : bumpLimit;

};

exports.setUpdateBlockForAutoSage = function(updateBlock) {

  updateBlock.$set.autoSage = true;

  updateBlock.$unset = {
    innerCache : 1,
    outerCache : 1,
    previewCache : 1,
    alternativeCaches : 1,
    clearCache : 1,
    hashedCache : 1
  };

};

exports.getSetBlock = function(thread, postId) {

  var latestPosts = thread.latestPosts || [];

  latestPosts.push(postId);

  latestPosts = latestPosts.sort(function compareNumbers(a, b) {
    return a - b;
  });

  var newOmittedPosts = false;

  if (latestPosts.length > latestPostsCount) {
    newOmittedPosts = true;
    latestPosts.splice(0, latestPosts.length - latestPostsCount);
  }

  var updateBlock = {
    $set : {
      latestPosts : latestPosts
    },
    $inc : {
      postCount : 1
    }
  };

  if (newOmittedPosts) {
    updateBlock.$unset = {
      outerCache : 1
    };
  }

  return updateBlock;

};

exports.youngEnoughToBump = function(boardData, thread) {

  if (!boardData.maxBumpAgeDays) {
    return true;
  }

  var date = new Date();

  date.setUTCDate(date.getUTCDate() - boardData.maxBumpAgeDays);

  return thread.creation > date;

};

exports.updateThread = function(boardData, parameters, postId, thread,
    language, callback, post) {

  var updateBlock = exports.getSetBlock(thread, postId);

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
              cleanPosts, bump, language, callback);

        });

      } else {
        exports.addPostToGlobalLatest(omitted, post, thread, parameters,
            cleanPosts, bump, language, callback);
      }

    }

  });

};

exports.createPost = function(req, parameters, userData, postId, thread, board,
    wishesToSign, cb) {

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
    threadId : parameters.threadId,
    signedRole : common.getSignedRole(userData, wishesToSign, board),
    creation : new Date(),
    subject : parameters.subject,
    name : nameToUse,
    id : id,
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

  posts.insertOne(postToAdd, function createdPost(error) {
    if (error) {
      cb(error);
    } else {

      common.recordFlood(req);

      // style exception, too simple
      uploadHandler.saveUploads(board, parameters.threadId, postId, parameters,
          function savedFiles() {
            exports.updateThread(board, parameters, postId, thread,
                req.language, cb, postToAdd);
          });
      // style exception, too simple

    }
  });

};

exports.getPostFlag = function(req, parameters, userData, postId, thread,
    board, wishesToSign, cb) {

  common.getFlagUrl(parameters.flag, logger.ip(req), board, parameters.noFlag,
      function gotFlagUrl(flagUrl, flagName, flagCode) {

        parameters.flagName = flagName;
        parameters.flag = flagUrl;
        parameters.flagCode = flagCode;

        exports.createPost(req, parameters, userData, postId, thread, board,
            wishesToSign, cb);
      });

};

exports.getPostMarkdown = function(req, parameters, userData, thread, board,
    wishesToSign, callback) {

  parameters.message = common.applyFilters(board.filters, parameters.message);

  common.markdownText(parameters.message, parameters.boardUri, board.settings
      .indexOf('allowCode') > -1, function gotMarkdown(error, markdown) {

    if (error) {
      callback(error);
    } else {
      parameters.markdown = markdown;

      // style exception, too simple
      boards.findOneAndUpdate({
        boardUri : parameters.boardUri
      }, {
        $inc : {
          lastPostId : 1
        }
      }, {
        returnOriginal : false
      }, function gotNewId(error, lastIdData) {
        if (error) {
          callback(error);
        } else {
          exports.getPostFlag(req, parameters, userData,
              lastIdData.value.lastPostId, thread, board, wishesToSign,
              callback);
        }
      });
      // style exception, too simple

    }

  });

};

exports.getThread = function(req, parameters, userData, board, callback) {

  threads.findOne({
    boardUri : parameters.boardUri,
    threadId : parameters.threadId
  }, {
    projection : {
      _id : 1,
      sfw : 1,
      salt : 1,
      page : 1,
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
    } else if (thread.postCount >= autoLockLimit) {
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
          exports.getPostMarkdown(req, parameters, userData, thread, board,
              wishesToSign, callback);
        }
      });
      // style exception, too simple

    }
  });

};

exports.checkR9K = function(req, parameters, userData, board, callback) {

  r9k.check(parameters, board, req.language, function checked(error) {

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

  if (!parameters.message && !parameters.files.length) {
    callback(lang(req.language).errNoFileAndMessage);
    return;
  }

  parameters.boardUri = parameters.boardUri.toString();

  boards.findOne({
    boardUri : parameters.boardUri
  }, {
    projection : {
      _id : 0,
      filters : 1,
      owner : 1,
      boardUri : 1,
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

    var boardLimitError = common.checkBoardFileLimits(parameters.files, board,
        req.language);

    var textBoard = board ? board.settings.indexOf('textBoard') > -1 : null;

    var locked = board && board.specialSettings;
    locked = locked && board.specialSettings.indexOf('locked') > -1;

    if (error) {
      callback(error);
    } else if (!board) {
      callback(lang(req.language).errBoardNotFound);
    } else if (textBoard && parameters.files.length) {
      callback(lang(req.language).errTextBoard);
    } else if (locked) {
      callback(lang(req.language).errLockedBoard);
    } else if (boardLimitError) {
      callback(boardLimitError);
    } else {

      // style exception, too simple
      captchaOps.attemptCaptcha(captchaId, parameters.captcha, board,
          req.language, function solvedCaptcha(error) {

            if (error) {
              callback(error);
            } else {
              exports.checkR9K(req, parameters, userData, board, callback);
            }

          }, true);
      // style exception, too simple

    }
  });

};