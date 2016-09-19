'use strict';

// The dbMigrations.s couldn't be any larger, this is where any migration from
// 1.6 onward will be

var db = require('./db');
var reports = db.reports();
var threads = db.threads();
var posts = db.posts();

// Added on 1.7
exports.deleteGhostReport = function(id, callback) {

  reports.deleteOne({
    _id : id
  }, function deletedReport(error) {
    if (error) {
      callback(error);
    } else {
      exports.removeGhostReports(callback, id);
    }
  });

};

exports.removeGhostReports = function(callback, lastId) {

  reports.findOne(lastId ? {
    _id : {
      $gt : lastId
    }
  } : {}, {
    boardUri : 1,
    threadId : 1,
    postId : 1
  }, function gotReport(error, report) {

    if (error) {
      callback(error);
    } else if (!report) {
      callback();
    } else {

      var collectionToUse = report.postId ? posts : threads;

      // style exception, too simple
      collectionToUse.findOne({
        boardUri : report.boardUri,
        threadId : report.threadId,
        postId : report.postId
      }, {
        boardUri : 1,
        _id : 0
      }, function gotPosting(error, posting) {

        if (error) {
          callback(error);
        } else if (posting) {
          exports.removeGhostReports(callback, report._id);
        } else {
          exports.deleteGhostReport(report._id, callback);
        }

      });
      // style exception, too simple

    }

  });

};