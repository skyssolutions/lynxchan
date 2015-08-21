'use strict';

var mongo = require('mongodb');
var ObjectID = mongo.ObjectID;
var db = require('../db');
var boards = db.boards();
var hashBans = db.hashBans();
var bans = db.bans();
var threads = db.threads();
var logs = db.logs();
var posts = db.posts();
var torOps = require('./torOps');
var reports = db.reports();
var miscOps = require('./miscOps');
var settings = require('../boot').getGeneralSettings();
var blockTor = settings.blockTor;
var blockProxy = settings.blockProxy;
var disableFloodCheck = settings.disableFloodCheck;
var multipleReports = settings.multipleReports;
var lang = require('./langOps').languagePack();
var logger = require('../logger');
var postOps = require('./postingOps');
var defaultBanMessage = settings.defaultBanMessage;
var flood = db.flood();

if (!defaultBanMessage) {
  defaultBanMessage = lang.miscDefaultBanMessage;
}

var reportArguments = [ {
  field : 'reason',
  length : 256,
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

var editArguments = [ {
  field : 'message',
  length : 2048,
  removeHTML : true
} ];

var hashBanArguments = [ {
  field : 'hash',
  length : 32,
  removeHTML : true
} ];

// Section 1: Shared functions {

exports.isInBoardStaff = function(userData, board) {

  var isOwner = board.owner === userData.login;

  var volunteers = board.volunteers || [];

  var isVolunteer = volunteers.indexOf(userData.login) > -1;

  return isOwner || isVolunteer;

};

// } Section 1: Shared functions

// Section 2: Read operations {

// Section 2.1: Bans {
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

  bans.find(queryBlock).sort({
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
      } else if (!exports.isInBoardStaff(userData, board) && !isOnGlobalStaff) {
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
// } Section 2.1: Bans

// Section 2.2: Range bans {
function getRangeBans(parameters, callback) {
  var queryBlock = {
    range : {
      $exists : true
    },
    boardUri : parameters.boardUri ? parameters.boardUri : {
      $exists : false
    }
  };

  bans.find(queryBlock).sort({
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
      } else if (!exports.isInBoardStaff(userData, board) && !isOnGlobalStaff) {
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
// } Section 2.2: Range bans

// Section 2.3: Hash bans {
function getHashBans(parameters, callback) {

  hashBans.find({
    boardUri : parameters.boardUri ? parameters.boardUri : {
      $exists : false
    }
  }).sort({
    md5 : 1
  }).toArray(function gotBans(error, hashBans) {
    callback(error, hashBans);
  });
}

exports.getHashBans = function(userData, parameters, callback) {

  var isOnGlobalStaff = userData.globalRole < miscOps.getMaxStaffRole();

  if (parameters.boardUri) {
    boards.findOne({
      boardUri : parameters.boardUri
    }, function gotBoard(error, board) {
      if (error) {
        callback(error);
      } else if (!board) {
        callback(lang.errBoardNotFound);
      } else if (!exports.isInBoardStaff(userData, board) && !isOnGlobalStaff) {
        callback(lang.errDeniedBoardHashBansManagement);
      } else {
        getHashBans(parameters, callback);
      }
    });
  } else if (!isOnGlobalStaff) {
    callback(lang.errDeniedGlobalHashBansManagement);
  } else {
    getHashBans(parameters, callback);
  }
};
// } Section 2.3: Hash bans

// Section 2.4: Closed reports {
function getClosedReports(parameters, callback) {

  var queryBlock = {
    closedBy : {
      $exists : true
    },
    global : parameters.boardUri ? false : true
  };

  reports.find(queryBlock).sort({
    creation : -1
  }).toArray(function gotReports(error, reports) {
    callback(error, reports);
  });

}

exports.getClosedReports = function(userData, parameters, callback) {

  var isOnGlobalStaff = userData.globalRole <= miscOps.getMaxStaffRole();

  if (parameters.boardUri) {
    boards.findOne({
      boardUri : parameters.boardUri
    }, function gotBoard(error, board) {
      if (error) {
        callback(error);
      } else if (!board) {
        callback(lang.errBoardNotFound);
      } else if (!exports.isInBoardStaff(userData, board) && !isOnGlobalStaff) {
        callback(lang.errDeniedBoardReportManagement);
      } else {
        getClosedReports(parameters, callback);
      }
    });
  } else if (!isOnGlobalStaff) {
    callback(lang.errDeniedGlobalReportManagement);
  } else {
    getClosedReports(parameters, callback);
  }

};
// } Section 2.4: Closed reports

// Section 2.5: Ban check {
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
// } Section 2.5: Ban check

exports.getPostingToEdit = function(userData, parameters, callback) {

  var globalStaff = userData.globalRole <= miscOps.getMaxStaffRole();

  boards.findOne({
    boardUri : parameters.boardUri
  }, function gotBoard(error, board) {
    if (error) {
      callback(error);
    } else if (!board) {
      callback(lang.errBoardNotFound);
    } else if (!globalStaff && !exports.isInBoardStaff(userData, board)) {
      callback(callback(lang.deniedEdit));
    } else {

      var collectionToUse;
      var query;

      if (parameters.postId) {

        query = {
          postId : +parameters.postId
        };
        collectionToUse = parameters.postId ? posts : threads;
      } else {
        collectionToUse = threads;

        query = {
          threadId : +parameters.threadId
        };

      }

      query.boardUri = parameters.boardUri;

      // style exception, too simple
      collectionToUse.findOne(query, function gotPosting(error, posting) {
        if (error) {
          callback(error);
        } else if (!posting) {
          callback(lang.errPostingNotFound);
        } else {
          callback(null, posting.message);
        }
      });
      // style exception, too simple
    }

  });

};

// } Section 2: Read Operations

// Section 3: Write Operations {

// Section 3.1: Create report {
function createReport(req, report, reportedContent, parameters, callback) {

  var toAdd = {
    global : parameters.global,
    boardUri : report.board,
    threadId : +report.thread,
    creation : new Date()
  };

  if (parameters.reason) {
    toAdd.reason = parameters.reason;
  }

  if (report.post) {
    toAdd.postId = +report.post;
  }

  reports.insert(toAdd, function createdReport(error) {
    if (error && error.code !== 11000) {
      callback(error);
    } else {
      exports.report(req, reportedContent, parameters, callback);
    }
  });

}

exports.report = function(req, reportedContent, parameters, callback) {

  miscOps.sanitizeStrings(parameters, reportArguments);

  if (!reportedContent.length) {
    callback();
  } else if (reportedContent.length > 1 && !multipleReports) {
    callback(lang.errDeniedMultipleReports);
  } else {

    var report = reportedContent.shift();

    var uriToCheck = parameters.global ? null : report.board;

    exports.checkForBan(req, uriToCheck, function checkedForBan(error, ban) {
      if (error || ban) {
        callback(error, ban);
      } else {
        // style exception, too simple
        var queryBlock = {
          boardUri : report.board,
          threadId : +report.thread
        };

        var countCb = function(error, count) {
          if (error) {
            callback(error);
          } else if (!count) {
            exports.report(req, reportedContent, parameters, callback);
          } else {
            createReport(req, report, reportedContent, parameters, callback);
          }

        };

        if (report.post) {

          queryBlock.postId = +report.post;

          posts.count(queryBlock, countCb);

        } else {
          threads.count(queryBlock, countCb);
        }

        // style exception, too simple
      }

    });

  }

};
// } Section 3.1: Create report

// Section 3.2: Close report {
function closeReport(report, userData, callback) {
  reports.updateOne({
    _id : new ObjectID(report._id)
  }, {
    $set : {
      closedBy : userData.login,
      closing : new Date()
    }
  }, function closedReport(error) {
    if (error) {
      callback(error);
    } else

    {
      // style exception, too simple

      var pieces = lang.logReportClosure;

      var logMessage = pieces.startPiece.replace('{$login}', userData.login);

      if (report.global) {
        logMessage += pieces.globalPiece;
      }

      logMessage += pieces.midPiece;

      if (report.postId) {
        logMessage += pieces.postPiece.replace('{$post}', report.postId);
      }

      logMessage += pieces.finalPiece.replace('{$thread}', report.threadId)
          .replace('{$board}', report.boardUri).replace('{$reason}',
              report.reason);

      logs.insert({
        user : userData.login,
        global : report.global,
        description : logMessage,
        time : new Date(),
        boardUri : report.boardUri,
        type : 'reportClosure'
      }, function insertedLog(error) {
        if (error) {

          logger.printLogError(logMessage, error);
        }

        callback(null, report.global, report.boardUri);
      });

      // style exception, too simple
    }

  });
}

exports.closeReport = function(userData, parameters, callback) {

  var isOnGlobalStaff = userData.globalRole <= miscOps.getMaxStaffRole();
  try {
    reports.findOne({
      _id : new ObjectID(parameters.reportId)
    }, function gotReport(error, report) {
      if (error) {
        callback(error);
      } else if (!report) {
        callback(lang.errReportNotFound);
      } else if (report.closedBy) {
        callback(lang.errReportAlreadyClosed);
      } else if (report.global && !isOnGlobalStaff) {
        callback(lang.errDeniedGlobalReportManagement);
      } else if (!report.global) {

        // style exception, too simple
        boards.findOne({
          boardUri : report.boardUri
        }, function gotBoard(error, board) {
          if (error) {
            callback(error);
          } else if (!board) {
            callback(lang.errBoardNotFound);
          } else if (!exports.isInBoardStaff(userData, board)) {
            callback(lang.errDeniedBoardReportManagement);
          } else {
            closeReport(report, userData, callback);
          }

        });

        // style exception, too simple

      } else {
        closeReport(report, userData, callback);
      }

    });
  } catch (error) {
    callback(error);
  }
};
// } Section 3.2: Close report

// Section 3.3: Ban {
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
    } else if (!exports.isInBoardStaff(userData, board) && !parameters.global) {
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
// } Section 3.3: Ban

// Section 3.4: Lift ban {
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
      board.volunteers = board.volunteers || [];

      var owner = board.owner === userData.login;

      if (owner || board.volunteers.indexOf(userData.login) > -1) {
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
// } Section 3.4: Lift ban

// Section 3.5: Thread settings {
function setNewThreadSettings(parameters, thread, callback) {

  parameters.lock = parameters.lock ? true : false;
  parameters.pin = parameters.pin ? true : false;
  parameters.cyclic = parameters.cyclic ? true : false;

  var changePin = parameters.pin !== thread.pinned;
  var changeLock = parameters.lock !== thread.locked;
  var changeCyclic = parameters.cyclic !== thread.cyclic;

  if (!changeLock && !changePin && !changeCyclic) {
    callback();

    return;
  }

  threads.updateOne({
    _id : new ObjectID(thread._id)
  }, {
    $set : {
      locked : parameters.lock,
      pinned : parameters.pin,
      cyclic : parameters.cyclic,
      autoSage : !parameters.cyclic
    }
  }, function updatedThread(error) {

    if (!error) {
      // signal rebuild of thread
      process.send({
        board : thread.boardUri,
        thread : thread.threadId
      });

      if (changePin) {
        // signal rebuild of board pages
        process.send({
          board : thread.boardUri
        });
      } else {
        // signal rebuild of page
        process.send({
          board : thread.boardUri,
          page : thread.page
        });
      }

    }

    callback(error);

  });
}

function getThreadToChangeSettings(parameters, callback) {

  threads.findOne({
    boardUri : parameters.boardUri,
    threadId : +parameters.threadId
  }, function gotThread(error, thread) {
    if (error) {
      callback(error);
    } else if (!thread) {
      callback(lang.errThreadNotFound);
    } else {

      setNewThreadSettings(parameters, thread, callback);

    }
  });
}

exports.setThreadSettings = function(userData, parameters, callback) {

  boards.findOne({
    boardUri : parameters.boardUri
  }, function gotBoard(error, board) {
    if (error) {
      callback(error);
    } else if (!board) {
      callback(lang.errBoardNotFound);
    } else if (!exports.isInBoardStaff(userData, board)) {
      callback(lang.errDeniedThreadManagement);
    } else {
      getThreadToChangeSettings(parameters, callback);
    }
  });

};
// } Section 3.5: Thread settings

// Section 3.6: Range ban{
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
      } else if (!exports.isInBoardStaff(userData, board) && !isOnGlobalStaff) {
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
// } Section 3.6: Range ban

// Section 3.7: Hash ban {
function placeHashBan(userData, parameters, callback) {
  var hashBan = {
    md5 : parameters.hash
  };

  if (parameters.boardUri) {
    hashBan.boardUri = parameters.boardUri;
  }

  hashBans.insert(hashBan, function insertedBan(error) {
    if (error && error.code !== 11000) {
      callback(error);
    } else if (error) {
      callback();
    } else {
      var pieces = lang.logHashBan;

      var logMessage = pieces.startPiece.replace('{$login}', userData.login);

      if (parameters.boardUri) {
        logMessage += pieces.boardPiece
            .replace('{$board}', parameters.boardUri);
      } else {
        logMessage += pieces.globalPiece;
      }

      logMessage += pieces.finalPiece.replace('{$hash}', parameters.hash);

      // style exception,too simple
      logs.insert({
        user : userData.login,
        global : parameters.boardUri ? false : true,
        time : new Date(),
        description : logMessage,
        type : 'hashBan',
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

exports.placeHashBan = function(userData, parameters, callback) {

  miscOps.sanitizeStrings(parameters, hashBanArguments);

  var isOnGlobalStaff = userData.globalRole < miscOps.getMaxStaffRole();

  if (parameters.boardUri) {
    boards.findOne({
      boardUri : parameters.boardUri
    }, function gotBoard(error, board) {
      if (error) {
        callback(error);
      } else if (!board) {
        callback(lang.errBoardNotFound);
      } else if (!exports.isInBoardStaff(userData, board) && !isOnGlobalStaff) {
        callback(lang.errDeniedBoardHashBansManagement);
      } else {
        placeHashBan(userData, parameters, callback);
      }
    });
  } else if (!isOnGlobalStaff) {
    callback(lang.errDeniedGlobalHashBansManagement);
  } else {
    placeHashBan(userData, parameters, callback);
  }

};
// } Section 3.7: Hash ban

// Section 3.8: Lift hash ban {
function liftHashBan(hashBan, userData, callback) {
  hashBans.remove({
    _id : new ObjectID(hashBan._id)
  }, function hashBanRemoved(error) {

    if (error) {
      callback(error);
    } else {
      // style exception, too simple

      var pieces = lang.logLiftHashBan;

      var logMessage = pieces.startPiece.replace('{$login}', userData.login);

      if (hashBan.boardUri) {
        logMessage += pieces.boardPiece.replace('{$board}', hashBan.boardUri);
      } else {
        logMessage += pieces.globalPiece;
      }

      logMessage += pieces.finalPiece.replace('{$hash}', hashBan.md5);

      logs.insert({
        user : userData.login,
        global : hashBan.boardUri ? false : true,
        time : new Date(),
        description : logMessage,
        type : 'hashBanLift',
        boardUri : hashBan.boardUri
      }, function insertedLog(error) {
        if (error) {

          logger.printLogError(logMessage, error);
        }

        callback(null, hashBan.boardUri);
      });

      // style exception, too simple
    }

  });
}

function checkForBoardHashBanLiftPermission(hashBan, userData, callback) {
  boards.findOne({
    boardUri : hashBan.boardUri
  }, function gotBoard(error, board) {
    if (error) {
      callback(error);
    } else if (!board) {
      callback();
    } else {
      board.volunteers = board.volunteers || [];

      var owner = board.owner === userData.login;

      if (owner || board.volunteers.indexOf(userData.login) > -1) {
        liftHashBan(hashBan, userData, callback);
      } else {
        callback(lang.errDeniedBoardHashBansManagement);
      }
    }
  });
}

exports.liftHashBan = function(userData, parameters, callback) {
  try {
    var globalStaff = userData.globalRole < miscOps.getMaxStaffRole();

    hashBans.findOne({
      _id : new ObjectID(parameters.hashBanId)
    }, function gotHashBan(error, hashBan) {
      if (error) {
        callback(error);
      } else if (!hashBan) {
        callback();
      } else if (hashBan.boardUri) {

        checkForBoardHashBanLiftPermission(hashBan, userData, callback);

      } else if (!globalStaff) {
        callback(lang.errDeniedGlobalHashBansManagement);
      } else {
        liftHashBan(hashBan, userData, callback);
      }
    });
  } catch (error) {
    callback(error);
  }
};
// } Section 3.8: Lift hash ban

// Section 3.9: Save edit {
function queueRebuild(page, board, threadId, callback) {
  process.send({
    board : board,
    thread : threadId
  });

  process.send({
    board : board,
    page : page
  });

  callback();
}

function saveEdit(parameters, login, callback) {

  var collectionToUse;
  var query;

  if (parameters.postId) {

    query = {
      postId : +parameters.postId
    };
    collectionToUse = parameters.postId ? posts : threads;
  } else {
    collectionToUse = threads;

    query = {
      threadId : +parameters.threadId
    };

  }

  query.boardUri = parameters.boardUri;

  collectionToUse.findOneAndUpdate(query, {
    $set : {
      lastEditTime : new Date(),
      lastEditLogin : login,
      markdown : parameters.markdown,
      message : parameters.message
    }
  }, function savedEdit(error, posting) {
    if (error) {
      callback(error);
    } else if (!posting.value) {
      callback(lang.errPostingNotFound);
    } else if (posting.value.postId) {

      // style exception, too simple
      threads.findOne({
        boardUri : parameters.boardUri,
        threadId : posting.value.threadId
      }, function gotThread(error, thread) {
        if (error) {
          callback(error);
        } else {
          queueRebuild(thread.page, parameters.boardUri,
              posting.value.threadId, callback);
        }
      });
      // style exception, too simple

    } else {
      queueRebuild(posting.value.page, parameters.boardUri,
          posting.value.threadId, callback);
    }

  });

}

exports.saveEdit = function(userData, parameters, callback) {

  miscOps.sanitizeStrings(parameters, editArguments);

  var globalStaff = userData.globalRole <= miscOps.getMaxStaffRole();

  boards.findOne({
    boardUri : parameters.boardUri
  }, function gotBoard(error, board) {
    if (error) {
      callback(error);
    } else if (!board) {
      callback(lang.errBoardNotFound);
    } else if (!globalStaff && !exports.isInBoardStaff(userData, board)) {
      callback(callback(lang.deniedEdit));
    } else {

      // style exception, too simple
      postOps.markdownText(parameters.message, parameters.boardUri,
          board.settings.indexOf('allowCode') > -1, function gotMarkdown(error,
              markdown) {
            if (error) {
              callback(error);
            } else {
              parameters.markdown = markdown;
              saveEdit(parameters, userData.login, callback);
            }
          });
      // style exception, too simple

    }
  });
};
// } Section 3.9: Save edit

// } Section 3: Write Operations

