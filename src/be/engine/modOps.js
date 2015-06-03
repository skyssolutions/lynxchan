'use strict';

var mongo = require('mongodb');
var ObjectID = mongo.ObjectID;
var db = require('../db');
var boards = db.boards();
var threads = db.threads();
var posts = db.posts();
var reports = db.reports();
var miscOps = require('./miscOps');

function getReports(parameters, callback) {

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
      } else if (!isInBoardStaff(userData, board) && !isOnGlobalStaff) {
        callback('You are not allowed to view reports for this board.');
      } else {
        getReports(parameters, callback);
      }
    });
  } else if (!isOnGlobalStaff) {
    callback('You are not allowed to view global reports');
  } else {
    getReports(parameters, callback);
  }

};

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

function isInBoardStaff(userData, board) {

  var isOwner = board.owner === userData.login;

  var volunteers = board.volunteers || [];

  var isVolunteer = volunteers.indexOf(userData.login) > -1;

  return isOwner || isVolunteer;

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
        } else if (!isInBoardStaff(userData, board)) {
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

function createReport(report, reportedContent, parameters, callback) {

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
      exports.report(reportedContent, parameters, callback);
    }
  });

}

exports.report = function(reportedContent, parameters, callback) {

  if (!reportedContent.length) {
    callback();
  } else {

    var report = reportedContent.shift();

    var queryBlock = {
      boardUri : report.board,
      threadId : +report.thread
    };

    var countCb = function(error, count) {
      if (error) {
        callback(error);
      } else if (!count) {
        exports.report(reportedContent, parameters, callback);
      } else {
        createReport(report, reportedContent, parameters, callback);
      }

    };

    if (report.post) {

      queryBlock.postId = +report.post;

      posts.count(queryBlock, countCb);

    } else {
      threads.count(queryBlock, countCb);
    }

  }

};