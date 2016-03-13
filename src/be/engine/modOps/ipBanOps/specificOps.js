'use strict';

var mongo = require('mongodb');
var ObjectID = mongo.ObjectID;
var db = require('../../../db');
var boards = db.boards();
var bans = db.bans();
var posts = db.posts();
var threads = db.threads();
var defaultBanMessage;
var logger;
var logOps;
var miscOps;
var minClearIps;
var captchaOps;
var common;
var lang;

var appealArguments = [ {
  length : 512,
  field : 'appeal',
  removeHTML : true
} ];

var banArguments = [ {
  field : 'reason',
  length : 256,
  removeHTML : true
}, {
  field : 'banMessage',
  length : 128,
  removeHTML : true
} ];

exports.loadSettings = function() {

  var settings = require('../../../settingsHandler').getGeneralSettings();
  defaultBanMessage = settings.defaultBanMessage;

  minClearIps = settings.clearIpMinRole;

  if (!defaultBanMessage) {
    defaultBanMessage = lang.miscDefaultBanMessage;
  }

};

exports.loadDependencies = function() {

  captchaOps = require('../../captchaOps');
  logOps = require('../../logOps');
  common = require('..').common;
  logger = require('../../../logger');
  miscOps = require('../../miscOps');
  lang = require('../../langOps').languagePack();

};

// Section 1: Ban {
exports.appendThreadsToBanLog = function(informedThreads, pieces) {

  var logMessage = '';

  if (informedThreads.length) {
    logMessage += pieces.threadPiece;

    for (var i = 0; i < informedThreads.length; i++) {

      if (i) {
        logMessage += ', ';
      }

      logMessage += ' ' + informedThreads[i];

    }

  }

  return logMessage;

};

exports.appendPostsToBanLog = function(informedPosts, informedThreads, pieces) {

  var logMessage = '';

  if (informedPosts.length) {
    if (informedThreads.length) {
      logMessage += pieces.threadAndPostPiece;
    }

    logMessage += pieces.postPiece;

    for (var i = 0; i < informedPosts.length; i++) {
      if (i) {
        logMessage += ', ';
      }

      logMessage += ' ' + informedPosts[i];
    }

  }

  return logMessage;

};

exports.logBans = function(userData, board, informedPosts, informedThreads,
    parameters, callback) {

  var pieces = lang.logPostingBan;

  var logMessage = pieces.startPiece.replace('{$login}', userData.login);

  if (parameters.global) {
    logMessage += pieces.globalPiece;
  }

  logMessage += pieces.midPiece;

  logMessage += exports.appendThreadsToBanLog(informedThreads, pieces);
  logMessage += exports.appendPostsToBanLog(informedPosts, informedThreads,
      pieces);

  logMessage += pieces.endPiece.replace('{$board}', board).replace(
      '{$expiration}', parameters.expiration).replace('{$reason}',
      parameters.reason || '');

  logOps.insertLog({
    user : userData.login,
    type : 'ban',
    time : new Date(),
    global : parameters.global,
    boardUri : board,
    description : logMessage
  }, callback);

};

exports.reloadPages = function(pages, board, informedThreads, informedPosts,
    parentThreads) {

  var rebuiltPages = [];

  for (var i = 0; i < pages.length; i++) {

    var page = pages[i];

    if (rebuiltPages.indexOf(page) === -1) {
      rebuiltPages.push(page);
      process.send({
        board : board,
        page : pages[i]
      });
    }
  }

  for (i = 0; i < informedThreads.length; i++) {
    process.send({
      board : board,
      thread : informedThreads[i]
    });

    process.send({
      board : board,
      thread : informedThreads[i],
      preview : true
    });
  }

  for (i = 0; i < informedPosts.length; i++) {

    process.send({
      board : board,
      post : informedPosts[i],
      preview : true
    });

  }

  for (i = 0; i < parentThreads.length; i++) {

    var parent = parentThreads[i];

    if (informedThreads.indexOf(parent) === -1) {
      process.send({
        board : board,
        thread : parent
      });
    }
  }

};

exports.updateThreadsBanMessage = function(pages, parentThreads, userData,
    parameters, callback, informedThreads, informedPosts, board) {

  threads.updateMany({
    boardUri : board,
    threadId : {
      $in : informedThreads
    }
  }, {
    $set : {
      banMessage : parameters.banMessage || defaultBanMessage
    }
  }, function setMessage(error) {

    if (error) {
      callback(error);
    } else {

      // style exception, too simple
      posts.updateMany({
        boardUri : board,
        postId : {
          $in : informedPosts
        }
      }, {
        $set : {
          banMessage : parameters.banMessage || defaultBanMessage
        }
      }, function setMessage(error) {
        if (error) {
          callback(error);
        } else {

          exports.reloadPages(pages, board, informedThreads, informedPosts,
              parentThreads);

          exports.logBans(userData, board, informedPosts, informedThreads,
              parameters, callback);

        }

      });
      // style exception, too simple

    }

  });

};

exports.createBans = function(foundIps, parentThreads, pages, board, userData,
    parameters, callback, informedThreads, informedPosts) {

  var newBans = [];

  for (var i = 0; i < foundIps.length; i++) {

    var ban = {
      appliedBy : userData.login
    };

    if (parameters.range) {
      ban.range = miscOps.getRange(foundIps[i]);
    } else {
      ban.ip = foundIps[i];
      ban.reason = parameters.reason;
      ban.expiration = parameters.expiration;
    }

    if (!parameters.global) {
      ban.boardUri = board;
    }

    newBans.push(ban);
  }

  if (!newBans.length) {
    callback();

    return;
  }

  bans.insertMany(newBans, function createdBans(error, result) {
    if (error) {
      callback(error);
    } else {
      if (!parameters.range) {

        exports.updateThreadsBanMessage(pages, parentThreads, userData,
            parameters, callback, informedThreads, informedPosts, board);
      } else {
        callback();
      }
    }
  });

};

exports.getPostIps = function(foundIps, pages, informedPosts, board, userData,
    parameters, callback, informedThreads) {

  posts.aggregate([ {
    $match : {
      boardUri : board,
      ip : {
        $nin : foundIps,
        $ne : null
      },
      postId : {
        $in : informedPosts
      }
    }
  }, {
    $group : {
      _id : 0,
      ips : {
        $addToSet : '$ip'
      },
      parents : {
        $addToSet : '$threadId'
      }
    }
  } ], function gotIps(error, results) {

    if (error) {
      callback(error);
    } else if (!results.length) {

      exports.createBans(foundIps, [], pages, board, userData, parameters,
          callback, informedThreads, informedPosts);

    } else {

      // style exception, too simple
      threads.aggregate([ {
        $match : {
          threadId : {
            $in : results[0].parents
          }
        }
      }, {
        $group : {
          _id : 0,
          pages : {
            $addToSet : '$page'
          },
          parents : {
            $addToSet : '$threadId'
          }
        }
      } ], function gotPages(error, pageResults) {
        if (error) {
          callback(error);
        } else {
          exports.createBans(foundIps.concat(results[0].ips),
              pageResults[0].parents, pages.concat(pageResults[0].pages),
              board, userData, parameters, callback, informedThreads,
              informedPosts);

        }
      });
      // style exception, too simple

    }
  });

};

exports.getThreadIps = function(board, userData, reportedObjects, parameters,
    callback) {

  var informedThreads = [];
  var informedPosts = [];

  for (var i = 0; i < reportedObjects.length; i++) {

    var object = reportedObjects[i];

    if (board === object.board) {

      if (object.post) {
        informedPosts.push(+object.post);
      } else {
        informedThreads.push(+object.thread);
      }

    }

  }

  threads.aggregate([ {
    $match : {
      boardUri : board,
      ip : {
        $ne : null
      },
      threadId : {
        $in : informedThreads
      }
    }
  }, {
    $group : {
      _id : 0,
      ips : {
        $addToSet : '$ip'
      },
      pages : {
        $addToSet : '$page'
      }

    }
  } ], function gotIps(error, results) {

    if (error) {
      callback(error);
    } else if (!results.length) {
      exports.getPostIps([], [], informedPosts, board, userData, parameters,
          callback, informedThreads);
    } else {
      exports.getPostIps(results[0].ips, results[0].pages, informedPosts,
          board, userData, parameters, callback, informedThreads);
    }

  });

};

exports.iterateBoards = function(foundBoards, userData, reportedObjects,
    parameters, callback) {

  if (!foundBoards.length) {
    callback();
    return;
  }

  var board = foundBoards.shift();

  boards.findOne({
    boardUri : board
  }, function gotBoard(error, board) {
    if (error) {
      callback(error);
    } else if (!board) {
      exports.iterateBoards(foundBoards, userData, reportedObjects, parameters,
          callback);
    } else if (!common.isInBoardStaff(userData, board) && !parameters.global) {
      exports.iterateBoards(foundBoards, userData, reportedObjects, parameters,
          callback);
    } else {

      // style exception, too simple
      exports.getThreadIps(board.boardUri, userData, reportedObjects,
          parameters, function createdBans(error) {
            if (error) {
              callback(error);
            } else {
              exports.iterateBoards(foundBoards, userData, reportedObjects,
                  parameters, callback);
            }
          });
      // style exception, too simple

    }
  });

};

exports.parseExpiration = function(parameters) {

  var expiration = Date.parse(parameters.expiration || '');

  if (isNaN(expiration)) {
    return true;
  } else {
    parameters.expiration = new Date(expiration);
  }

};

exports.isolateBoards = function(userData, reportedObjects, parameters,
    callback) {

  miscOps.sanitizeStrings(parameters, banArguments);

  if (!parameters.range && exports.parseExpiration(parameters)) {
    callback(lang.errInvalidExpiration);
  }

  var allowedToGlobalBan = userData.globalRole < miscOps.getMaxStaffRole();

  var allowedGlobalRangeBan = userData.globalRole <= minClearIps;

  if (parameters.global && !allowedToGlobalBan) {
    callback(lang.errDeniedGlobalBanManagement);
  } else if (!allowedGlobalRangeBan && parameters.global && parameters.range) {
    callback(lang.errDeniedGlobalRangeBanManagement);
  } else {
    var foundBoards = [];

    for (var i = 0; i < reportedObjects.length && i < 1000; i++) {
      var report = reportedObjects[i];

      if (report.board && foundBoards.indexOf(report.board) === -1) {
        foundBoards.push(report.board.toString());
      }
    }

    exports.iterateBoards(foundBoards, userData, reportedObjects, parameters,
        callback);
  }

};

exports.ban = function(userData, reportedObjects, parameters, captchaId,
    callback) {

  captchaOps.attemptCaptcha(captchaId, parameters.captcha, null,
      function solvedCaptcha(error) {
        if (error) {
          callback(error);
        } else {
          exports
              .isolateBoards(userData, reportedObjects, parameters, callback);
        }
      });

};
// } Section 1: Ban

// Section 2: Appeal {
exports.appealBan = function(ip, parameters, callback) {

  try {

    miscOps.sanitizeStrings(parameters, appealArguments);

    bans.findOneAndUpdate({
      _id : new ObjectID(parameters.banId),
      ip : ip,
      appeal : {
        $exists : false
      }
    }, {
      $set : {
        appeal : parameters.appeal
      }
    }, function gotBan(error, result) {

      if (error) {
        callback(error);
      } else if (!result.value) {
        callback(lang.errBanNotFound);
      } else {
        callback();
      }

    });

  } catch (error) {
    callback(error);
  }

};
// } Section 2: Appeal

// Section 3: Deny appeal {
exports.writeDeniedAppeal = function(userData, ban, callback) {

  bans.updateOne({
    _id : new ObjectID(ban._id)
  }, {
    $set : {
      denied : true
    }
  }, function deniedAppeal(error) {
    if (error) {
      callback(error);
    } else {

      // style exception, too simple
      logOps.insertLog({
        user : userData.login,
        type : 'appealDeny',
        time : new Date(),
        boardUri : ban.boardUri,
        global : ban.boardUri ? false : true,
        description : lang.logAppealDenied.replace('{$login}', userData.login)
            .replace('{$id}', ban._id)
      }, function logged() {
        callback(null, ban.boardUri);
      });
      // style exception, too simple

    }
  });

};

exports.checkAppealDenyBoardPermission = function(userData, ban, callback) {

  boards.findOne({
    boardUri : ban.boardUri
  }, function gotBoard(error, board) {
    if (error) {
      callback(error);
    } else if (!board) {
      callback(lang.errBoardNotFound);
    } else if (!common.isInBoardStaff(userData, board, 2)) {
      callback(lang.errDeniedBoardBanManagement);
    } else {
      exports.writeDeniedAppeal(userData, ban, callback);
    }
  });

};

exports.denyAppeal = function(userData, banId, callback) {

  var globalStaff = userData.globalRole < miscOps.getMaxStaffRole();

  try {

    bans.findOne({
      _id : new ObjectID(banId),
      appeal : {
        $exists : true
      },
      denied : {
        $exists : false
      }
    }, function gotBan(error, ban) {
      if (error) {
        callback(error);
      } else if (!ban) {
        callback(lang.errBanNotFound);
      } else if (!ban.boardUri && !globalStaff) {
        callback(lang.errDeniedGlobalBanManagement);
      } else if (ban.boardUri) {
        exports.checkAppealDenyBoardPermission(userData, ban, callback);
      } else {
        exports.writeDeniedAppeal(userData, ban, callback);
      }
    });
  } catch (error) {
    callback(error);
  }

};
// } Section 3: Deny appeal
