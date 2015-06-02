'use strict';

var db = require('../db');
var threads = db.threads();
var posts = db.posts();
var reports = db.reports();

function createReport(report, reportedContent, parameters, callback) {

  var toAdd = {
    reason : parameters.reason,
    global : parameters.global,
    boardUri : report.board,
    threadId : +report.thread
  };

  if (report.post) {
    toAdd.postId = +report.post;
  }

  reports.insert(toAdd, function createdReport(error) {
    if (error) {
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