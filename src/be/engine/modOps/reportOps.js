'use strict';

// handles report operations

var mongo = require('mongodb');
var ObjectID = mongo.ObjectID;
var db = require('../../db');
var boards = db.boards();
var threads = db.threads();
var posts = db.posts();
var reports = db.reports();
var logger = require('../../logger');
var multipleReports;
var logOps;
var miscOps;
var delOps;
var generator;
var moduleRoot;
var ipBan;
var common;
var captchaOps;
var lang;
var allowBlockedToReport;

var reportArguments = [ {
  field : 'reason',
  length : 256,
  removeHTML : true
} ];

exports.loadSettings = function() {

  var settings = require('../../settingsHandler').getGeneralSettings();
  multipleReports = settings.multipleReports;
  allowBlockedToReport = settings.allowBlockedToReport;

};

exports.loadDependencies = function() {

  delOps = require('../deletionOps').postingDeletions;
  logOps = require('../logOps');
  miscOps = require('../miscOps');
  generator = require('../generator');
  moduleRoot = require('.');
  ipBan = moduleRoot.ipBan.versatile;
  common = moduleRoot.common;
  captchaOps = require('../captchaOps');
  lang = require('../langOps').languagePack;

};

// Section 1: Closed reports {
exports.readClosedReports = function(parameters, callback) {

  var queryBlock = {
    closedBy : {
      $exists : true
    },
    global : parameters.boardUri ? false : true
  };

  if (parameters.boardUri) {
    queryBlock.boardUri = parameters.boardUri;
  }

  reports.find(queryBlock, {
    boardUri : 1,
    threadId : 1,
    closedBy : 1,
    postId : 1,
    reason : 1,
    closing : 1
  }).sort({
    creation : -1
  }).toArray(callback);

};

exports.getClosedReports = function(userData, parameters, language, callback) {

  var isOnGlobalStaff = userData.globalRole <= miscOps.getMaxStaffRole();

  if (parameters.boardUri) {
    parameters.boardUri = parameters.boardUri.toString();

    boards.findOne({
      boardUri : parameters.boardUri
    }, function gotBoard(error, board) {
      if (error) {
        callback(error);
      } else if (!board) {
        callback(lang(language).errBoardNotFound);
      } else if (!common.isInBoardStaff(userData, board)) {
        callback(lang(language).errDeniedBoardReportManagement);
      } else {
        exports.readClosedReports(parameters, callback);
      }
    });
  } else if (!isOnGlobalStaff) {
    callback(lang(language).errDeniedGlobalReportManagement);
  } else {
    exports.readClosedReports(parameters, callback);
  }

};
// } Section 1: Closed reports

// Section 2: Create report {
exports.createReport = function(req, report, reportedContent, parameters,
    callback) {

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

  reports.insertOne(toAdd, function createdReport(error) {
    if (error && error.code !== 11000) {
      callback(error);
    } else {
      exports.iterateReports(req, reportedContent, parameters, callback);
    }
  });

};

exports.findReportedContent = function(report, req, reportedContent,
    parameters, cb) {

  var queryBlock = {
    boardUri : report.board,
    threadId : +report.thread
  };

  var checkCb = function(error, posting) {
    if (error) {
      cb(error);
    } else if (!posting) {
      exports.iterateReports(req, reportedContent, parameters, cb);
    } else {
      exports.createReport(req, report, reportedContent, parameters, cb);
    }

  };

  if (report.post) {

    queryBlock.postId = +report.post;

    posts.findOne(queryBlock, checkCb);

  } else {
    threads.findOne(queryBlock, checkCb);
  }

};

exports.iterateReports = function(req, reportedContent, parameters, cb) {

  if (!reportedContent.length) {
    cb();
    return;
  }

  var report = reportedContent.shift();

  if (allowBlockedToReport) {
    exports.findReportedContent(report, req, reportedContent, parameters, cb);
  } else {
    var uriToCheck = parameters.global ? null : report.board;

    ipBan.checkForBan(req, uriToCheck, function checkedForBan(error, ban) {
      if (error || ban) {
        cb(error, ban);
      } else {
        exports.findReportedContent(report, req, reportedContent, parameters,
            cb);
      }
    });
  }

};

exports.report = function(req, reportedContent, parameters, captchaId, cb) {

  miscOps.sanitizeStrings(parameters, reportArguments);

  captchaOps.attemptCaptcha(captchaId, parameters.captcha, null, req.language,
      function solvedCaptcha(error) {
        if (error) {
          cb(error);
        } else {

          var isArray = Object.prototype.toString.call(reportedContent);
          if (isArray !== '[object Array]') {
            cb();
          } else {
            reportedContent = reportedContent.slice(0, 1000);

            if (reportedContent.length > 1 && !multipleReports) {
              cb(lang(req.language).errDeniedMultipleReports);
            } else {
              exports.iterateReports(req, reportedContent, parameters, cb);
            }

          }

        }

      });

};
// } Section 2: Create report

// Section 3: Close report {
exports.logReportClosure = function(foundReports, userData, closureDate,
    callback) {

  var logs = [];

  for (var i = 0; i < foundReports.length; i++) {

    var report = foundReports[i];

    var pieces = lang().logReportClosure;

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
            report.reason || '');

    logs.push({
      user : userData.login,
      global : report.global,
      description : logMessage,
      time : closureDate,
      boardUri : report.boardUri,
      type : 'reportClosure'
    });

  }

  logOps.insertLog(logs, function insertedLog() {
    callback(null, foundReports[0].global, foundReports[0].boardUri);
  });

};

exports.deleteClosedContent = function(foundReports, userData, closureDate,
    language, callback) {

  var postsToDelete = {};
  var threadsToDelete = {};

  for (var i = 0; i < foundReports.length; i++) {

    var report = foundReports[i];

    var listToUse = report.postId ? postsToDelete : threadsToDelete;

    var subListToUse = listToUse[report.boardUri] || [];

    subListToUse.push(report.postId || report.threadId);

    listToUse[report.boardUri] = subListToUse;

  }

  delOps.posting(userData, {}, threadsToDelete, postsToDelete, language,
      function deleted(error) {

        if (error) {
          callback(error);
        } else {
          exports.logReportClosure(foundReports, userData, closureDate,
              callback);
        }

      });

};

exports.updateReports = function(deleteReportedContent, foundReports, ids,
    userData, language, callback) {

  var closureDate = new Date();

  reports.updateMany({
    _id : {
      $in : ids
    }
  }, {
    $set : {
      closedBy : userData.login,
      closing : closureDate
    }
  },
      function closedReports(error) {
        if (error) {
          callback(error);
        } else {

          if (deleteReportedContent) {
            exports.deleteClosedContent(foundReports, userData, closureDate,
                language, callback);
          } else {
            exports.logReportClosure(foundReports, userData, closureDate,
                callback);
          }

        }

      });
};

exports.closeFoundReports = function(deleteContent, ids, userData,
    foundReports, language, callback) {

  var foundBoardsUris = [];

  var isOnGlobalStaff = userData.globalRole <= miscOps.getMaxStaffRole();

  // Get boards for non-global reports, check if reports have been
  // already closed and global permissions
  for (var i = 0; i < foundReports.length; i++) {
    var report = foundReports[i];

    var alreadyIncluded = foundBoardsUris.indexOf(report.boardUri) > -1;

    if (report.closedBy) {
      callback(lang(language).errReportAlreadyClosed);
      return;
    } else if (report.global && !isOnGlobalStaff) {
      callback(lang(language).errDeniedGlobalReportManagement);
      return;
    } else if (!report.global && !alreadyIncluded) {
      foundBoardsUris.push(report.boardUri);
    }

  }

  boards.find({
    boardUri : {
      $in : foundBoardsUris
    }
  }).toArray(
      function gotBoards(error, foundBoards) {
        if (error) {
          callback(error);
        } else if (foundBoards.length < foundBoardsUris.length) {
          callback(lang(language).errBoardNotFound);
        } else {

          for (i = 0; i < foundBoards.length; i++) {

            if (!common.isInBoardStaff(userData, foundBoards[i])) {
              callback(lang(language).errDeniedBoardReportManagement);
              return;
            }

          }

          exports.updateReports(deleteContent, foundReports, ids, userData,
              language, callback);

        }

      });

};

exports.closeReports = function(userData, parameters, language, callback) {

  try {
    var ids = [];

    var reportList = parameters.reports || [];

    if (!reportList.length) {
      callback(lang(language).errNoReportsInformed);
      return;
    }

    for (var i = 0; i < reportList.length; i++) {
      ids.push(new ObjectID(reportList[i]));
    }

  } catch (error) {
    callback(error);
    return;
  }

  reports.find({
    _id : {
      $in : ids
    }
  }).toArray(
      function gotReports(error, foundReports) {

        if (error) {
          callback(error);
        } else if (foundReports.length < ids.length) {
          callback(lang(language).errReportNotFound);
        } else {
          exports.closeFoundReports(parameters.deleteContent, ids, userData,
              foundReports, language, callback);
        }

      });

};
// } Section 3: Close report

// Section 4: Reported content association {
exports.associateFoundThreads = function(reports, foundThreads) {

  for (var i = 0; i < reports.length; i++) {

    var report = reports[i];

    for (var j = 0; j < foundThreads.length; j++) {

      var thread = foundThreads[j];

      var matches = thread.boardUri === report.boardUri;
      matches = matches && thread.threadId === report.threadId;

      if (matches && !report.postId) {

        thread.postId = thread.threadId;
        report.associatedPost = thread;
        foundThreads.splice(foundThreads.indexOf(thread), 1);

        break;
      }

    }

  }

};

exports.associateFoundPosts = function(reports, foundPosts) {

  for (var i = 0; i < reports.length; i++) {

    var report = reports[i];

    for (var j = 0; j < foundPosts.length; j++) {
      var post = foundPosts[j];

      var matches = report.boardUri === post.boardUri;
      matches = matches && report.postId === post.postId;

      if (matches) {
        report.associatedPost = post;
        foundPosts.splice(foundPosts.indexOf(post), 1);
        break;
      }

    }

  }

};

exports.associatePostsContent = function(reports, postsOrArray, callback) {

  if (!postsOrArray.length) {
    callback();

    return;
  }

  posts.find({
    $or : postsOrArray
  }, generator.postProjection).toArray(function gotPosts(error, foundPosts) {

    if (error) {
      callback(error);
    } else {

      exports.associateFoundPosts(reports, foundPosts);

      callback();

    }

  });

};

exports.associateContent = function(reports, callback) {

  var postsOrArray = [];
  var threadsOrArray = [];

  for (var i = 0; i < reports.length; i++) {

    var report = reports[i];

    var matchObject = {
      boardUri : report.boardUri,
      postId : report.postId,
      threadId : report.threadId
    };

    if (report.postId) {
      postsOrArray.push(matchObject);
    } else {
      threadsOrArray.push(matchObject);
    }

  }

  if (threadsOrArray.length) {

    threads.find({
      $or : threadsOrArray
    }, generator.threadProjection).toArray(
        function gotThreads(error, foundThreads) {

          if (error) {
            callback(error);
          } else {

            exports.associateFoundThreads(reports, foundThreads);

            exports.associatePostsContent(reports, postsOrArray, callback);

          }

        });

  } else {
    exports.associatePostsContent(reports, postsOrArray, callback);
  }

};
// } Section 4: Reported content association
