'use strict';

var mongo = require('mongodb');
var ObjectID = mongo.ObjectID;
var miscOps = require('../miscOps');
var db = require('../../db');
var bans = db.bans();
var flood = db.flood();
var boards = db.boards();
var logs = db.logs();
var threads = db.threads();
var posts = db.posts();
var common = require('.').common;
var lang = require('../langOps').languagePack();
var torOps = require('../torOps');
var settings = require('../../boot').getGeneralSettings();
var defaultBanMessage = settings.defaultBanMessage;
var disableFloodCheck = settings.disableFloodCheck;
var blockTor = settings.torAccess < 1;
var blockProxy = settings.proxyAccess < 1;
var logger = require('../../logger');

if (!defaultBanMessage) {
  defaultBanMessage = lang.miscDefaultBanMessage;
}

var banArguments = [ {
  field : 'reason',
  length : 256,
  removeHTML : true
}, {
  field : 'banMessage',
  length : 128,
  removeHTML : true
} ];

// Section 1: Bans {
function getBans(parameters, callback) {
  var queryBlock = {
    ip : {
      $exists : true
    },
    expiration : {
      $gt : new Date()
    },
    boardUri : parameters.boardUri ? parameters.boardUri : {
      $exists : false
    }
  };

  bans.find(queryBlock, {
    reason : 1,
    expiration : 1,
    appliedBy : 1
  }).sort({
    creation : -1
  }).toArray(function gotBans(error, bans) {
    callback(error, bans);
  });
}

exports.getBans = function(userData, parameters, callback) {

  var isOnGlobalStaff = userData.globalRole < miscOps.getMaxStaffRole();

  if (parameters.boardUri) {
    boards.findOne({
      boardUri : parameters.boardUri
    }, function gotBoard(error, board) {
      if (error) {
        callback(error);
      } else if (!board) {
        callback(lang.errBoardNotFound);
      } else if (!common.isInBoardStaff(userData, board)) {
        callback(lang.errDeniedBoardBanManagement);
      } else {
        getBans(parameters, callback);
      }
    });
  } else if (!isOnGlobalStaff) {
    callback(lang.errDeniedGlobalBanManagement);
  } else {
    getBans(parameters, callback);
  }

};
// } Section 1: Bans

// Section 2: Range bans {
function getRangeBans(parameters, callback) {
  var queryBlock = {
    range : {
      $exists : true
    },
    boardUri : parameters.boardUri ? parameters.boardUri : {
      $exists : false
    }
  };

  bans.find(queryBlock, {
    range : 1
  }).sort({
    creation : -1
  }).toArray(function gotBans(error, rangeBans) {
    callback(error, rangeBans);
  });
}

exports.getRangeBans = function(userData, parameters, callback) {

  var isOnGlobalStaff = userData.globalRole < miscOps.getMaxStaffRole();

  if (parameters.boardUri) {
    boards.findOne({
      boardUri : parameters.boardUri
    }, function gotBoard(error, board) {
      if (error) {
        callback(error);
      } else if (!board) {
        callback(lang.errBoardNotFound);
      } else if (!common.isInBoardStaff(userData, board)) {
        callback(lang.errDeniedBoardRangeBanManagement);
      } else {
        getRangeBans(parameters, callback);
      }
    });
  } else if (!isOnGlobalStaff) {
    callback(lang.errDeniedGlobalRangeBanManagement);
  } else {
    getRangeBans(parameters, callback);
  }

};
// } Section 2: Range bans

// Section 3: Ban check {
function getActiveBan(ip, boardUri, callback) {

  var range = miscOps.getRange(ip);

  var singleBanAnd = {
    $and : [ {
      expiration : {
        $gt : new Date()
      }
    }, {
      ip : ip
    } ]
  };

  var rangeBanCondition = {
    range : range
  };

  var globalOrLocalOr = {
    $or : [ {
      boardUri : boardUri
    }, {
      boardUri : {
        $exists : false
      }
    } ]
  };

  var finalCondition = {
    $and : [ globalOrLocalOr, {
      $or : [ rangeBanCondition, singleBanAnd ]
    } ]
  };

  bans.findOne(finalCondition, callback);

}

exports.checkForBan = function(req, boardUri, callback) {

  torOps.markAsTor(req, function markedAsTor(error) {
    if (error) {
      callback(error);
    } else if (req.isTor) {
      callback(blockTor ? lang.errBlockedTor : null);
    } else if (req.isProxy) {
      callback(blockProxy ? lang.errBlockedProxy : null);
    } else {

      var ip = logger.ip(req);

      // style exception, too simple
      flood.count({
        ip : ip,
        expiration : {
          $gt : new Date()
        }
      }, function gotCount(error, count) {
        if (error) {
          callback(error);
        } else if (count && !disableFloodCheck) {
          callback(lang.errFlood);
        } else {
          getActiveBan(ip, boardUri, callback);
        }
      });
      // style exception, too simple

    }

  });

};
// } Section 3: Ban check

// Section 4: Ban {
function appendThreadsToBanLog(informedThreads, pieces) {

  var logMessage = '';

  if (informedThreads.length) {
    logMessage += pieces.threadPiece;

    for (var i = 0; i < informedThreads.length; i++) {

      if (i) {
        logMessage += ',';
      }

      logMessage += ' ' + informedThreads[i];

    }

  }

  return logMessage;

}

function appendPostsToBanLog(informedPosts, informedThreads, pieces) {

  var logMessage = '';

  if (informedPosts.length) {
    if (informedThreads.length) {
      logMessage += pieces.threadAndPostPiece;
    }

    logMessage += pieces.postPiece;

    for (var i = 0; i < informedPosts.length; i++) {
      if (i) {
        logMessage += ',';
      }

      logMessage += ' ' + informedPosts[i];
    }

  }

  return logMessage;

}

function logBans(foundBoards, userData, board, informedPosts, informedThreads,
    reportedObjects, parameters, callback) {

  var pieces = lang.logPostingBan;

  var logMessage = pieces.startPiece.replace('{$login}', userData.login);

  if (parameters.global) {
    logMessage += pieces.globalPiece;
  }

  logMessage += pieces.midPiece;

  logMessage += appendThreadsToBanLog(informedThreads, pieces);
  logMessage += appendPostsToBanLog(informedPosts, informedThreads, pieces);

  logMessage += pieces.endPiece.replace('{$board}', board).replace(
      '{$expiration}', parameters.expiration).replace('{$reason}',
      parameters.reason);

  logs.insert({
    user : userData.login,
    type : 'ban',
    time : new Date(),
    global : parameters.global,
    boardUri : board,
    description : logMessage
  },
      function insertedLog(error) {
        if (error) {

          logger.printLogError(logMessage, error);
        }

        iterateBoards(foundBoards, userData, reportedObjects, parameters,
            callback);

      });

}

function updateThreadsBanMessage(pages, parentThreads, foundBoards, userData,
    reportedObjects, parameters, callback, informedThreads, informedPosts,
    board) {

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

          logBans(foundBoards, userData, board, informedPosts, informedThreads,
              reportedObjects, parameters, callback);

        }

      });
      // style exception, too simple

    }

  });

}

function createBans(foundIps, parentThreads, pages, foundBoards, board,
    userData, reportedObjects, parameters, callback, informedThreads,
    informedPosts) {

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
      updateThreadsBanMessage(pages, parentThreads, foundBoards, userData,
          reportedObjects, parameters, callback, informedThreads,
          informedPosts, board);
    }
  });

}

function getPostIps(foundIps, pages, foundBoards, informedPosts, board,
    userData, reportedObjects, parameters, callback, informedThreads) {

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
  } ],
      function gotIps(error, results) {

        if (error) {
          callback(error);
        } else if (!results.length) {

          createBans(foundIps, [], pages, foundBoards, board, userData,
              reportedObjects, parameters, callback, informedThreads,
              informedPosts);

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
              createBans(foundIps.concat(results[0].ips),
                  pageResults[0].parents, pages.concat(pageResults[0].pages),
                  foundBoards, board, userData, reportedObjects, parameters,
                  callback, informedThreads, informedPosts);

            }
          });
          // style exception, too simple

        }
      });

}

function getThreadIps(board, foundBoards, userData, reportedObjects,
    parameters, callback) {

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
      getPostIps([], [], foundBoards, informedPosts, board, userData,
          reportedObjects, parameters, callback, informedThreads);
    } else {
      getPostIps(results[0].ips, results[0].pages, foundBoards, informedPosts,
          board, userData, reportedObjects, parameters, callback,
          informedThreads);
    }

  });

}

function iterateBoards(foundBoards, userData, reportedObjects, parameters,
    callback) {

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
      iterateBoards(foundBoards, userData, reportedObjects, parameters,
          callback);
    } else if (!common.isInBoardStaff(userData, board) && !parameters.global) {
      iterateBoards(foundBoards, userData, reportedObjects, parameters,
          callback);
    } else {
      getThreadIps(board.boardUri, foundBoards, userData, reportedObjects,
          parameters, callback);
    }
  });

}

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

    iterateBoards(foundBoards, userData, reportedObjects, parameters, callback);
  }

};
// } Section 4: Ban

// Section 5: Lift ban {
function getLiftedBanLogMessage(ban, userData) {

  var pieces = lang.logBanLift;

  var logMessage = pieces.startPiece.replace('{$login}', userData.login);

  if (ban.ip) {

    if (!ban.boardUri) {
      logMessage += pieces.globalBanPiece;
    } else {
      logMessage += pieces.boardBanPiece.replace('{$board}', ban.boardUri);
    }

    logMessage += pieces.finalBanPiece.replace('{$ban}', ban._id).replace(
        '{$expiration}', ban.expiration);
  } else if (ban.range) {

    if (!ban.boardUri) {
      logMessage += pieces.globalRangeBanPiece;
    } else {
      logMessage += pieces.boardRangeBanPiece.replace('{$board}', ban.boardUri);
    }

    logMessage += pieces.finalRangeBanPIece.replace('{$range}', ban.range);

  } else {
    logMessage += pieces.unknownPiece.replace('{$ban}', ban._id);
  }

  return logMessage;
}

function liftBan(ban, userData, callback) {

  bans.remove({
    _id : new ObjectID(ban._id)
  }, function banRemoved(error) {

    if (error) {
      callback(error);
    } else {
      // style exception, too simple

      var logMessage = getLiftedBanLogMessage(ban, userData);

      logs.insert({
        user : userData.login,
        global : ban.boardUri ? false : true,
        time : new Date(),
        description : logMessage,
        type : 'banLift',
        boardUri : ban.boardUri
      }, function insertedLog(error) {
        if (error) {

          logger.printLogError(logMessage, error);
        }

        callback(null, ban.range ? true : false, ban.boardUri);
      });

      // style exception, too simple
    }

  });

}

function checkForBoardBanLiftPermission(ban, userData, callback) {

  boards.findOne({
    boardUri : ban.boardUri
  }, function gotBoard(error, board) {
    if (error) {
      callback(error);
    } else if (!board) {
      callback();
    } else {

      if (common.isInBoardStaff(userData, board)) {
        liftBan(ban, userData, callback);
      } else {
        callback(lang.errDeniedBoardBanManagement);
      }
    }
  });

}

exports.liftBan = function(userData, parameters, callback) {

  var globalStaff = userData.globalRole < miscOps.getMaxStaffRole();

  try {
    bans.findOne({
      _id : new ObjectID(parameters.banId)
    }, function gotBan(error, ban) {
      if (error) {
        callback(error);
      } else if (!ban) {
        callback();
      } else if (ban.boardUri) {

        checkForBoardBanLiftPermission(ban, userData, callback);

      } else if (!globalStaff) {
        callback(lang.errDeniedGlobalBanManagement);
      } else {
        liftBan(ban, userData, callback);
      }
    });
  } catch (error) {
    callback(error);
  }

};
// } Section 5: Lift ban

// Section 6: Range ban{
function placeRangeBan(userData, parameters, callback) {

  var processedRange = [];

  var informedRange = parameters.range.toString().trim().split('.');

  for (var i = 0; i < informedRange.length && i < 8; i++) {

    var part = +informedRange[i];

    if (!isNaN(part) && part <= 255 && part >= 0) {
      processedRange.push(part);
    }
  }

  var rangeBan = {
    range : processedRange,
    appliedBy : userData.login,
  };

  if (parameters.boardUri) {
    rangeBan.boardUri = parameters.boardUri;
  }

  bans.insert(rangeBan, function insertedBan(error) {
    if (error) {
      callback(error);
    } else {
      var pieces = lang.logRangeBan;

      var logMessage = pieces.startPiece.replace('{$login}', userData.login);

      if (parameters.boardUri) {
        logMessage += pieces.boardPiece
            .replace('{$board}', parameters.boardUri);
      } else {
        logMessage += pieces.globalPiece;
      }

      logMessage += pieces.finalPiece.replace('{$range}', parameters.range);

      // style exception,too simple
      logs.insert({
        user : userData.login,
        global : parameters.boardUri ? false : true,
        time : new Date(),
        description : logMessage,
        type : 'rangeBan',
        boardUri : parameters.boardUri
      }, function insertedLog(error) {
        if (error) {

          logger.printLogError(logMessage, error);
        }

        callback();
      });
      // style exception,too simple
    }
  });
}

exports.placeRangeBan = function(userData, parameters, callback) {

  var isOnGlobalStaff = userData.globalRole < miscOps.getMaxStaffRole();

  if (parameters.boardUri) {
    boards.findOne({
      boardUri : parameters.boardUri
    }, function gotBoard(error, board) {
      if (error) {
        callback(error);
      } else if (!board) {
        callback(lang.errBoardNotFound);
      } else if (!common.isInBoardStaff(userData, board)) {
        callback(lang.errDeniedBoardRangeBanManagement);
      } else {
        placeRangeBan(userData, parameters, callback);
      }
    });
  } else if (!isOnGlobalStaff) {
    callback(lang.errDeniedGlobalRangeBanManagement);
  } else {
    placeRangeBan(userData, parameters, callback);
  }

};
// } Section 6: Range ban
