'use strict';

var db = require('../../../db');
var boards = db.boards();
var bans = db.bans();
var posts = db.posts();
var threads = db.threads();
var settings = require('../../../settingsHandler').getGeneralSettings();
var defaultBanMessage = settings.defaultBanMessage;
var logger;
var logOps;
var miscOps;
var common;

var lang;

var banArguments = [ {
  field : 'reason',
  length : 256,
  removeHTML : true
}, {
  field : 'banMessage',
  length : 128,
  removeHTML : true
} ];

exports.loadDependencies = function() {

  logOps = require('../../logOps');
  common = require('..').common;
  logger = require('../../../logger');
  miscOps = require('../../miscOps');
  lang = require('../../langOps').languagePack();

  if (!defaultBanMessage) {
    defaultBanMessage = lang.miscDefaultBanMessage;
  }

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
      parameters.reason);

  logOps.insertLog({
    user : userData.login,
    type : 'ban',
    time : new Date(),
    global : parameters.global,
    boardUri : board,
    description : logMessage
  }, callback);

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

  var operations = [];

  for (var i = 0; i < foundIps.length; i++) {

    var ban = {
      reason : parameters.reason,
      expiration : parameters.expiration,
      ip : foundIps[i],
      appliedBy : userData.login
    };

    if (!parameters.global) {
      ban.boardUri = board;
    }

    operations.push({
      insertOne : {
        document : ban
      }
    });

  }

  if (!operations.length) {
    callback();

    return;
  }

  bans.bulkWrite(operations, function createdBans(error, result) {
    if (error) {
      callback(error);
    } else {
      exports.updateThreadsBanMessage(pages, parentThreads, userData,
          parameters, callback, informedThreads, informedPosts, board);
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

exports.ban = function(userData, reportedObjects, parameters, callback) {

  miscOps.sanitizeStrings(parameters, banArguments);

  var expiration = Date.parse(parameters.expiration || '');

  if (isNaN(expiration)) {
    callback(lang.errInvalidExpiration);

    return;
  } else {
    parameters.expiration = new Date(expiration);
  }

  var allowedToGlobalBan = userData.globalRole < miscOps.getMaxStaffRole();

  if (parameters.global && !allowedToGlobalBan) {
    callback(lang.errDeniedGlobalBanManagement);
  } else {
    var foundBoards = [];

    for (var i = 0; i < reportedObjects.length; i++) {
      var report = reportedObjects[i];

      if (foundBoards.indexOf(report.board) === -1) {
        foundBoards.push(report.board);
      }
    }

    exports.iterateBoards(foundBoards, userData, reportedObjects, parameters,
        callback);
  }

};
// } Section 1: Ban
