'use strict';

var mongo = require('mongodb');
var ObjectID = mongo.ObjectID;
var db = require('../db');
var boards = db.boards();
var bans = db.bans();
var threads = db.threads();
var posts = db.posts();
var reports = db.reports();
var miscOps = require('./miscOps');

var banArguments = [ {
  field : 'reason',
  length : 256
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
function closeReport(userData, parameters, callback) {
  reports.updateOne({
    _id : new ObjectID(parameters.reportId)
  }, {
    $set : {
      closedBy : userData.login,
      closing : new Date()
    }
  }, function closedReport(error) {
    callback(error);
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
          closeReport(userData, parameters, callback);
        }

      });

      // style exception, too simple

    } else {
      closeReport(userData, parameters, callback);
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
function createBans(foundIps, foundBoards, board, userData, reportedObjects,
    parameters, callback) {

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

  bans.bulkWrite(operations, function createdBans(error, result) {
    if (error) {
      callback(error);
    } else {
      iterateBoards(foundBoards, userData, reportedObjects, parameters,
          callback);
    }
  });

}

function getPostIps(foundIps, foundBoards, informedPosts, board, userData,
    reportedObjects, parameters, callback) {

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
  } ], function gotIps(error, results) {

    if (error) {
      callback(error);
    } else if (!results.length) {

      createBans(foundIps, foundBoards, board, userData, reportedObjects,
          parameters, callback);

    } else {
      createBans(foundIps.concact(results[0].ips), foundBoards, board,
          userData, reportedObjects, parameters, callback);
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
          reportedObjects, parameters, callback);
    } else {
      getPostIps(results[0].ips, foundBoards, informedPosts, board, userData,
          reportedObjects, parameters, callback);
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

};// end of ban process
