'use strict';

// handles replies to threads

var db = require('../../db');
var boards = db.boards();
var files = db.files();
var posts = db.posts();
var threads = db.threads();
var logger = require('../../logger');
var debug = require('../../kernel').debug();
var common = require('.').common;
var gsHandler;
var overboardOps;
var generator;
var referenceHandler;
var r9k;
var uploadHandler;
var lang;
var miscOps;
var captchaOps;
var overboard;
var sfwOverboard;

var autoLockLimit;
var bumpLimit;
var verbose;
var latestPostsCount;
var globalLatestPosts;

exports.loadSettings = function() {

  var settings = require('../../settingsHandler').getGeneralSettings();

  sfwOverboard = settings.sfwOverboard;
  overboard = settings.overboard;
  verbose = settings.verbose;
  bumpLimit = settings.autoSageLimit;
  latestPostsCount = settings.latestPostCount;
  globalLatestPosts = settings.globalLatestPosts;
  autoLockLimit = bumpLimit * 2;
};

exports.loadDependencies = function() {

  overboardOps = require('../overboardOps');
  referenceHandler = require('../referenceHandler');
  gsHandler = require('../gridFsHandler');
  generator = require('../generator').board;
  r9k = require('../r9k');
  uploadHandler = require('../uploadHandler');
  lang = require('../langOps').languagePack();
  miscOps = require('../miscOps');
  captchaOps = require('../captchaOps');

};

exports.cleanPostFiles = function(files, postId, callback) {

  gsHandler.removeFiles(files, function removedFiles(error) {
    callback(error, postId);
  });

};

exports.updateThreadAfterCleanUp = function(boardUri, threadId, removedPosts,
    postId, removedFileCount, callback) {

  threads.updateOne({
    boardUri : boardUri,
    threadId : threadId
  }, {
    $inc : {
      postCount : -removedPosts.length,
      fileCount : -removedFileCount
    }
  }, function updatedThread(error) {
    if (error) {
      callback(error);
    } else {

      // style exception, too simple
      files.aggregate([ {
        $match : {
          'metadata.boardUri' : boardUri,
          'metadata.postId' : {
            $in : removedPosts
          }
        }
      }, {
        $group : {
          _id : 0,
          files : {
            $push : '$filename'
          }
        }
      } ], function gotFileNames(error, results) {
        if (error) {
          callback(error);
        } else if (!results.length) {
          callback(null, postId);
        } else {
          exports.cleanPostFiles(results[0].files, postId, callback);
        }

      });
      // style exception, too simple

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
      exports.updateThreadAfterCleanUp(boardUri, threadId, postsToDelete,
          postId, removedFileCount, callback);
    }
  });

};

exports.cleanThreadPosts = function(boardUri, threadId, postId, callback) {

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
  } ], function gotPosts(error, results) {
    if (error) {
      callback(error);
    } else if (!results.length) {
      callback(null, postId);
    } else {

      var postsToDelete = results[0].posts;
      var removedFileCount = results[0].removedFileCount;

      // style exception, too simple
      referenceHandler.clearPostingReferences(boardUri, null, postsToDelete,
          false, function removedReferences(error) {

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
    cleanPosts, bump, callback) {

  // signal rebuild of thread
  process.send({
    board : parameters.boardUri,
    thread : parameters.threadId
  });

  // signal rebuild of preview
  process.send({
    board : parameters.boardUri,
    post : postId,
    preview : true
  });

  // signal rebuild of board catalog
  process.send({
    board : parameters.boardUri,
    catalog : true
  });

  if (parameters.email !== 'sage') {

    for (var i = 0; i < (thread.page || 1); i++) {

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

  if (overboard || sfwOverboard) {
    overboardOps.reaggregate({
      overboard : true,
      _id : thread._id,
      post : true,
      bump : bump,
      sfw : thread.sfw
    });
  }

  common.addPostToStats(ip, parameters.boardUri, function updatedStats(error) {
    if (error) {
      console.log(error.toString());
    }

    if (cleanPosts) {
      exports.cleanThreadPosts(parameters.boardUri, parameters.threadId,
          postId, callback);
    } else {
      callback(error, postId);
    }

  });

};

exports.addPostToGlobalLatest = function(post, thread, parameters, cleanPosts,
    bump, callback) {

  if (!globalLatestPosts || !post.message.length) {
    exports.updateBoardForPostCreation(post.ip, parameters, post.postId,
        thread, cleanPosts, bump, callback);

  } else {

    common.addPostToLatestPosts(post, function addedToLatestPosts(error) {
      if (error) {
        console.log(error);
      }

      exports.updateBoardForPostCreation(post.ip, parameters, post.postId,
          thread, cleanPosts, bump, callback);

    });
  }
};

exports.getLatestPosts = function(thread, postId) {
  var latestPosts = thread.latestPosts || [];

  latestPosts.push(postId);

  latestPosts = latestPosts.sort(function compareNumbers(a, b) {
    return a - b;
  });

  if (latestPosts.length > latestPostsCount) {
    latestPosts.splice(0, latestPosts.length - latestPostsCount);
  }

  return latestPosts;

};

exports.getBumpLimit = function(boardData) {

  // No need to check if the number here is greater than 0, since it will be
  // used just to check a condition
  var hasBoardLimit = boardData.autoSageLimit;
  hasBoardLimit = hasBoardLimit && boardData.autoSageLimit < bumpLimit;

  return hasBoardLimit ? boardData.autoSageLimit : bumpLimit;

};

exports.updateThread = function(boardData, parameters, postId, thread,
    callback, post) {

  var updateBlock = {
    $set : {
      latestPosts : exports.getLatestPosts(thread, postId)
    },
    $inc : {
      postCount : 1
    }
  };

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
        updateBlock.$set.autoSage = true;
      }

    } else {
      bump = !saged;
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

      exports.addPostToGlobalLatest(post, thread, parameters, cleanPosts, bump,
          callback);

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
            exports.updateThread(board, parameters, postId, thread, cb,
                postToAdd);
          });
      // style exception, too simple

    }
  });

};

exports.getPostFlag = function(req, parameters, userData, postId, thread,
    board, wishesToSign, cb) {

  common.getFlagUrl(parameters.flag, logger.ip(req), board,
      function gotFlagUrl(flagUrl, flagName) {

        parameters.flagName = flagName;
        parameters.flag = flagUrl;

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
    _id : 1,
    sfw : 1,
    salt : 1,
    page : 1,
    cyclic : 1,
    locked : 1,
    autoSage : 1,
    postCount : 1,
    latestPosts : 1
  }, function gotThread(error, thread) {
    if (error) {
      callback(error);
    } else if (!thread) {
      callback(lang.errThreadNotFound);
    } else if (thread.locked) {
      callback(lang.errThreadLocked);
    } else if (thread.postCount >= autoLockLimit) {
      callback(lang.errThreadAutoLocked);
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

  r9k.check(parameters, board, function checked(error) {

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
    callback(lang.errNoFileAndMessage);
    return;
  }

  parameters.boardUri = parameters.boardUri.toString();

  boards.findOne({
    boardUri : parameters.boardUri
  }, {
    _id : 0,
    filters : 1,
    owner : 1,
    boardUri : 1,
    usesCustomSpoiler : 1,
    anonymousName : 1,
    specialSettings : 1,
    acceptedMimes : 1,
    maxFiles : 1,
    captchaMode : 1,
    autoSageLimit : 1,
    maxFileSizeMB : 1,
    settings : 1,
    volunteers : 1
  }, function gotBoard(error, board) {

    var boardLimitError = common.checkBoardFileLimits(parameters.files, board);

    if (error) {
      callback(error);
    } else if (!board) {
      callback(lang.errBoardNotFound);
    } else if (boardLimitError) {
      callback(boardLimitError);
    } else {

      // style exception, too simple
      captchaOps.attemptCaptcha(captchaId, parameters.captcha, board,
          function solvedCaptcha(error) {

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