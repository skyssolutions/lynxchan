'use strict';

var mongo = require('mongodb');
var ObjectID = mongo.ObjectID;
var db = require('../db');
var boards = db.boards();
var bans = db.bans();
var threads = db.threads();
var logs = db.logs();
var posts = db.posts();
var reports = db.reports();
var miscOps = require('./miscOps');
var settings = require('../boot').getGeneralSettings();
var logger = require('../logger');
var defaultBanMessage = settings.defaultBanMessage;

if (!defaultBanMessage) {
  defaultBanMessage = '(USER WAS BANNED FOR THIS POST)';
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

exports.isInBoardStaff = function(userData, board) {

  var isOwner = board.owner === userData.login;

  var volunteers = board.volunteers || [];

  var isVolunteer = volunteers.indexOf(userData.login) > -1;

  return isOwner || isVolunteer;

};

// start of reading bans

function getBans(parameters, callback) {
  var queryBlock = {
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

  var isOnGlobalStaff = userData.globalRole <= miscOps.getMaxStaffRole();

  if (parameters.boardUri) {
    boards.findOne({
      boardUri : parameters.boardUri
    }, function gotBoard(error, board) {
      if (error) {
        callback(error);
      } else if (!board) {
        callback('Board not found');
      } else if (!exports.isInBoardStaff(userData, board) && !isOnGlobalStaff) {
        callback('You are not allowed to view bans for this board.');
      } else {
        getBans(parameters, callback);
      }
    });
  } else if (!isOnGlobalStaff) {
    callback('You are not allowed to view global bans');
  } else {
    getBans(parameters, callback);
  }

};
// end of reading bans

// start of reading of closed reports
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
        callback('Board not found');
      } else if (!exports.isInBoardStaff(userData, board) && !isOnGlobalStaff) {
        callback('You are not allowed to view reports for this board.');
      } else {
        getClosedReports(parameters, callback);
      }
    });
  } else if (!isOnGlobalStaff) {
    callback('You are not allowed to view global reports');
  } else {
    getClosedReports(parameters, callback);
  }

};
// end of reading of closed reports

// start of closing reports
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

      var logMessage = 'User ' + userData.login + ' closed a ';

      if (report.global) {
        logMessage += ' global';
      }

      logMessage += ' report for';

      if (report.postId) {
        logMessage += ' post ' + report.postId + ' on';
      }

      logMessage += ' thread ' + report.threadId + ' on board /';
      logMessage += report.boardUri + '/ created under';
      logMessage += ' the reason of ' + report.reason + '.';

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

  reports.findOne({
    _id : new ObjectID(parameters.reportId)
  }, function gotReport(error, report) {
    if (error) {
      callback(error);
    } else if (!report) {
      callback('Report not found');
    } else if (report.closedBy) {
      callback('Report is already closed');
    } else if (report.global && !isOnGlobalStaff) {
      callback('You are not allowed to close global reports');
    } else if (!report.global) {

      // style exception, too simple
      boards.findOne({
        boardUri : report.boardUri
      }, function gotBoard(error, board) {
        if (error) {
          callback(error);
        } else if (!board) {
          callback('Board not found');
        } else if (!exports.isInBoardStaff(userData, board)) {
          callback('You are not allowed to close reports for this board.');
        } else {
          closeReport(report, userData, callback);
        }

      });

      // style exception, too simple

    } else {
      closeReport(report, userData, callback);
    }

  });

};
// end of closing reports

// start of report process
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
  } else {

    var report = reportedContent.shift();

    bans.count({
      ip : req.connection.remoteAddress,
      expiration : {
        $gt : new Date()
      },
      $or : [ {
        boardUri : report.board
      }, {
        boardUri : {
          $exists : false
        }
      } ]
    }, function gotCount(error, count) {
      if (error) {
        callback(error);
      } else if (count) {
        exports.report(req, reportedContent, parameters, callback);
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

// end of ban process
// start of ban process
function appendThreadsToBanLog(informedThreads) {

  var logMessage = '';

  if (informedThreads.length) {
    logMessage += ' threads :';

    for (var i = 0; i < informedThreads.length; i++) {

      if (i) {
        logMessage += ',';
      }

      logMessage += ' ' + informedThreads[i];

    }

  }

  return logMessage;

}

function appendPostsToBanLog(informedPosts, informedThreads) {

  var logMessage = '';

  if (informedPosts.length) {
    if (informedThreads.length) {
      logMessage += ' and the following posts:';
    } else {
      logMessage += ' posts:';
    }

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

  var logMessage = 'User ' + userData.login;

  if (parameters.global) {
    logMessage += ' globally';
  }

  logMessage += ' banned the following';

  logMessage += appendThreadsToBanLog(informedThreads);
  logMessage += appendPostsToBanLog(informedPosts, informedThreads);

  logMessage += ' from /' + board + '/ until ' + parameters.expiration;
  logMessage += ' with the reason "' + parameters.reason + '".';

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

function updateThreadsBanMessage(foundBoards, userData, reportedObjects,
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

          logBans(foundBoards, userData, board, informedPosts, informedThreads,
              reportedObjects, parameters, callback);

        }

      });
      // style exception, too simple
    }

  });

}

function createBans(foundIps, foundBoards, board, userData, reportedObjects,
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
      updateThreadsBanMessage(foundBoards, userData, reportedObjects,
          parameters, callback, informedThreads, informedPosts, board);
    }
  });

}

function getPostIps(foundIps, foundBoards, informedPosts, board, userData,
    reportedObjects, parameters, callback, informedThreads) {

  posts.aggregate([ {
    $match : {
      boardUri : board,
      ip : {
        $nin : foundIps
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
      }
    }
  } ],
      function gotIps(error, results) {

        if (error) {
          callback(error);
        } else if (!results.length) {

          createBans(foundIps, foundBoards, board, userData, reportedObjects,
              parameters, callback, informedThreads, informedPosts);

        } else {
          createBans(foundIps.concat(results[0].ips), foundBoards, board,
              userData, reportedObjects, parameters, callback, informedThreads,
              informedPosts);
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
      threadId : {
        $in : informedThreads
      }
    }
  }, {
    $group : {
      _id : 0,
      ips : {
        $addToSet : '$ip'
      }
    }
  } ], function gotIps(error, results) {

    if (error) {
      callback(error);
    } else if (!results.length) {
      getPostIps([], foundBoards, informedPosts, board, userData,
          reportedObjects, parameters, callback, informedThreads);
    } else {
      getPostIps(results[0].ips, foundBoards, informedPosts, board, userData,
          reportedObjects, parameters, callback, informedThreads);
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
    callback('Invalid expiration');

    return;
  } else {
    parameters.expiration = new Date(expiration);
  }

  var allowedToGlobalBan = userData.globalRole < miscOps.getMaxStaffRole();

  if (parameters.global && !allowedToGlobalBan) {
    callback('You are not allowed to issue global bans');
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
// end of ban process

// start of ban lift

function liftBan(ban, userData, callback) {

  bans.remove({
    _id : new ObjectID(ban._id)
  }, function banRemoved(error) {

    if (error) {
      callback(error);
    } else {
      // style exception, too simple

      var logMessage = 'User ' + userData.login + ' lifted a';

      if (!ban.boardUri) {
        logMessage += ' global ban';
      } else {
        logMessage += ' ban on board ' + ban.boardUri;
      }

      logMessage += ' with id ' + ban._id + ' set to expire at ';
      logMessage += ban.expiration + '.';

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

        callback();
      });

      // style exception, too simple
    }

  });

}

function checkForBoardPermission(ban, userData, callback) {

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
        callback('You are not allowed to lift bans from this board.');
      }
    }
  });

}

exports.liftBan = function(userData, parameters, callback) {

  bans.findOne({
    _id : new ObjectID(parameters.banId),
    expiration : {
      $gt : new Date()
    }
  }, function gotBan(error, ban) {
    if (error) {
      callback(error);
    } else if (!ban) {
      callback();
    } else if (ban.boardUri) {

      checkForBoardPermission(ban, userData, callback);

    } else if (userData.globalRole >= miscOps.getMaxStaffRole()) {
      callback('You are not allowed to lift global bans.');
    } else {
      liftBan(ban, userData, callback);
    }
  });

};

// end of ban lift

// start of thread settings process
function setNewThreadSettings(parameters, thread, callback) {

  parameters.lock = parameters.lock ? true : false;
  parameters.pin = parameters.pin ? true : false;

  var changePin = parameters.pin !== thread.pinned;
  var changeLock = parameters.lock !== thread.locked;

  if (!changeLock && !changePin) {
    callback();

    return;
  }

  threads.updateOne({
    _id : new ObjectID(thread._id)
  }, {
    $set : {
      locked : parameters.lock,
      pinned : parameters.pin
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
      callback('Thread not found');
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
      callback('Board not found');
    } else if (!exports.isInBoardStaff(userData, board)) {
      error = 'You are not allowed to change thread settingso in this board.';
      callback(error);
    } else {
      getThreadToChangeSettings(parameters, callback);
    }
  });

};

// start of thread settings process
