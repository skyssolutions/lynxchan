'use strict';

// handles report operations

var mongo = require('mongodb');
var ObjectID = mongo.ObjectID;
var db = require('../../db');
var boards = db.boards();
var threads = db.threads();
var posts = db.posts();
var bans = db.bans();
var users = db.users();
var reports = db.reports();
var logger = require('../../logger');
var maxStaffRole;
var multipleReports;
var logOps;
var miscOps;
var delOps;
var domManipulator;
var generator;
var moduleRoot;
var ipBan;
var specificOps;
var formOps;
var common;
var captchaOps;
var globalBoardModeration;
var lang;
var allowBlockedToReport;

exports.reportArguments = [ {
  field : 'reason',
  length : 256,
  removeHTML : true
} ];

exports.loadSettings = function() {

  var settings = require('../../settingsHandler').getGeneralSettings();
  multipleReports = settings.multipleReports;
  allowBlockedToReport = settings.allowBlockedToReport;
  globalBoardModeration = settings.allowGlobalBoardModeration;

};

exports.loadDependencies = function() {

  formOps = require('../formOps');
  delOps = require('../deletionOps').postingDeletions;
  logOps = require('../logOps');
  miscOps = require('../miscOps');
  generator = require('../generator');
  moduleRoot = require('.');
  ipBan = moduleRoot.ipBan.versatile;
  specificOps = moduleRoot.ipBan.specific;
  common = moduleRoot.common;
  captchaOps = require('../captchaOps');
  lang = require('../langOps').languagePack;
  maxStaffRole = require('../miscOps').getMaxStaffRole();
  domManipulator = require('../domManipulator').dynamicPages.miscPages;

};

// Section 1: Closed reports {
exports.readClosedReports = function(parameters, callback) {

  var queryBlock = {
    closedBy : {
      $exists : true
    }
  };

  if (parameters.boardUri) {
    queryBlock.boardUri = parameters.boardUri;
    queryBlock.global = false;
  } else if (!globalBoardModeration) {
    queryBlock.global = true;
  }

  reports.find(queryBlock, {
    projection : {
      boardUri : 1,
      threadId : 1,
      closedBy : 1,
      postId : 1,
      reason : 1,
      closing : 1
    }
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
exports.fetchEmails = function(req, report, mods, callback) {

  users.aggregate([ {
    $match : {
      confirmed : true,
      settings : 'reportNotify',
      email : {
        $exists : true,
        $ne : null
      },
      login : {
        $in : mods
      }
    }
  }, {
    $group : {
      _id : 0,
      emails : {
        $addToSet : '$email'
      }
    }
  } ]).toArray(function gotEmails(error, results) {

    if (error || !results.length) {
      callback(error);
    } else {

      var subject = lang().subReportNotify;

      if (report.reason) {
        subject += ': ' + report.reason;
      }

      var url = formOps.getDomain(req) + '/' + report.boardUri;
      url += '/res/' + report.threadId + '.html';

      if (report.postId) {
        url += '#' + report.postId;
      }

      var body = domManipulator.reportNotificationEmail(url);

      miscOps.sendMail(subject, body, results[0].emails, callback);

    }

  });

};

exports.fetchGlobalUsers = function(req, report, mods, callback) {

  if (!report.global && !globalBoardModeration) {
    exports.fetchEmails(req, report, mods, callback);
    return;
  }

  users.aggregate([ {
    $match : {
      globalRole : {
        $lte : maxStaffRole
      },
      login : {
        $nin : mods
      }
    }
  }, {
    $group : {
      _id : 0,
      logins : {
        $addToSet : '$login'
      }
    }
  } ]).toArray(
      function gotGlobalUsers(error, results) {

        if (error) {
          callback(error);
        } else if (!results.length) {
          exports.fetchEmails(req, report, mods, callback);
        } else {

          exports.fetchEmails(req, report, mods.concat(results[0].logins),
              callback);

        }

      });

};

exports.notifyReport = function(req, report, callback) {

  if (report.global) {
    exports.fetchGlobalUsers(req, report, [], callback);
    return;
  }

  boards.findOne({
    boardUri : report.boardUri
  }, {
    projection : {
      owner : 1,
      _id : 0,
      volunteers : 1
    }
  }, function gotBoard(error, board) {

    if (error) {
      callback(error);
    } else {

      var mods = board.volunteers || [];

      mods.push(board.owner);

      exports.fetchGlobalUsers(req, report, mods, callback);

    }

  });

};

exports.createReport = function(req, report, reportedContent, parameters,
    callback) {

  var toAdd = {
    global : parameters.global,
    boardUri : report.board,
    threadId : +report.thread,
    creation : new Date(),
    ip : logger.ip(req)
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
    } else if (error) {
      exports.iterateReports(req, reportedContent, parameters, callback);
    } else {

      // style exception, too simple
      exports.notifyReport(req, toAdd, function notified(error) {

        if (error) {
          console.log(error);
        }

        exports.iterateReports(req, reportedContent, parameters, callback);

      });
      // style exception, too simple

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

  miscOps.sanitizeStrings(parameters, exports.reportArguments);

  captchaOps.attemptCaptcha(captchaId, parameters.captcha, null, req.language,
      function solvedCaptcha(error) {
        if (error) {
          cb(error);
        } else {

          if (!Array.isArray(reportedContent)) {
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
        .replace('{$board}', report.boardUri);

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

exports.banReporter = function(parameters, foundReports, userData, closureDate,
    callback) {

  if (!parameters.banReporter) {
    exports.logReportClosure(foundReports, userData, closureDate, callback);

    return;

  }

  specificOps.parseExpiration(parameters);

  var bansToAdd = [];

  for (var i = 0; i < foundReports.length; i++) {

    var report = foundReports[i];

    if (!report.ip) {
      continue;
    }

    bansToAdd.push({
      ip : report.ip,
      expiration : parameters.expiration,
      boardUri : report.global ? undefined : report.boardUri
    });

  }

  if (!bansToAdd.length) {
    exports.logReportClosure(foundReports, userData, closureDate, callback);
    return;
  }

  bans.insertMany(bansToAdd, function addedBans(error) {

    if (error) {
      callback(error);
    } else {
      exports.logReportClosure(foundReports, userData, closureDate, callback);
    }

  });

};

exports.deleteClosedContent = function(parameters, foundReports, userData,
    closureDate, language, callback) {

  if (!parameters.deleteContent) {

    exports.banReporter(parameters, foundReports, userData, closureDate,
        callback);

    return;
  }

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
          exports.banReporter(parameters, foundReports, userData, closureDate,
              callback);
        }

      });

};

exports.updateReports = function(parameters, foundReports, ids, userData,
    language, callback) {

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
  }, function closedReports(error) {
    if (error) {
      callback(error);
    } else {

      exports.deleteClosedContent(parameters, foundReports, userData,
          closureDate, language, callback);

    }

  });
};

exports.closeFoundReports = function(parameters, ids, userData, foundReports,
    language, callback) {

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

          exports.updateReports(parameters, foundReports, ids, userData,
              language, callback);

        }

      });

};

exports.closeReports = function(userData, parameters, language, callback) {

  var ids = [];

  var reportList = parameters.reports || [];

  if (!reportList.length) {
    callback(lang(language).errNoReportsInformed);
    return;
  }

  for (var i = 0; i < reportList.length; i++) {
    try {
      ids.push(new ObjectID(reportList[i]));
    } catch (error) {
      callback(lang(language).errReportNotFound);
      return;
    }
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
          exports.closeFoundReports(parameters, ids, userData, foundReports,
              language, callback);
        }

      });

};
// } Section 3: Close report

// Section 4: Reported content association {
exports.associateFoundThreads = function(reports, foundThreads) {

  var association = {};

  for (var i = 0; i < foundThreads.length; i++) {
    var thread = foundThreads[i];
    thread.postId = thread.threadId;
    association[thread.boardUri] = association[thread.boardUri] || {};

    association[thread.boardUri][thread.threadId] = thread;

  }

  for (i = 0; i < reports.length; i++) {

    var report = reports[i];

    if (report.postId) {
      continue;
    }

    var boardObject = association[report.boardUri] || {};

    report.associatedPost = boardObject[report.threadId];

  }

};

exports.associateFoundPosts = function(reports, foundPosts) {

  var association = {};

  for (var i = 0; i < foundPosts.length; i++) {
    var post = foundPosts[i];
    association[post.boardUri] = association[post.boardUri] || {};

    association[post.boardUri][post.postId] = post;

  }

  for (i = 0; i < reports.length; i++) {

    var report = reports[i];

    if (!report.postId) {
      continue;
    }

    var boardObject = association[report.boardUri] || {};

    report.associatedPost = boardObject[report.postId];

  }

};

exports.associatePostsContent = function(reports, postsOrArray, callback) {

  if (!postsOrArray.length) {
    callback();

    return;
  }

  posts.find({
    $or : postsOrArray
  }, {
    projection : generator.postProjection
  }).toArray(function gotPosts(error, foundPosts) {

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
    }, {
      projection : generator.threadProjection
    }).toArray(function gotThreads(error, foundThreads) {

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
