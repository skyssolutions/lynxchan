'use strict';

// handles report operations

var mongo = require('mongodb');
var ObjectID = mongo.ObjectId;
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
var redactedModNames;
var domManipulator;
var generator;
var moduleRoot;
var locationOps;
var ipBan;
var specificOps;
var formOps;
var common;
var captchaOps;
var globalBoardModeration;
var reportCategories;
var lang;
var noReportCaptcha;
var allowBlockedToReport;

exports.reportArguments = [ {
  field : 'reasonReport',
  length : 256,
  removeHTML : true
} ];

exports.closeArguments = [ {
  field : 'banReason',
  length : 256,
  removeHTML : true
} ];

exports.loadSettings = function() {

  var settings = require('../../settingsHandler').getGeneralSettings();
  multipleReports = settings.multipleReports;
  reportCategories = settings.reportCategories;
  redactedModNames = settings.redactModNames;
  noReportCaptcha = settings.noReportCaptcha;
  allowBlockedToReport = settings.allowBlockedToReport;
  globalBoardModeration = settings.allowGlobalBoardModeration;

};

exports.loadDependencies = function() {

  formOps = require('../formOps');
  delOps = require('../deletionOps').postingDeletions;
  logOps = require('../logOps');
  miscOps = require('../miscOps');
  generator = require('../generator');
  locationOps = require('../locationOps');
  moduleRoot = require('.');
  ipBan = moduleRoot.ipBan.versatile;
  specificOps = moduleRoot.ipBan.specific;
  common = moduleRoot.common;
  captchaOps = require('../captchaOps');
  lang = require('../langOps').languagePack;
  maxStaffRole = require('../miscOps').getMaxStaffRole();
  domManipulator = require('../domManipulator').dynamicPages.miscPages;

};

exports.getQueryBlock = function(parameters, userData, closed) {

  var query = {
    closedBy : {
      $exists : closed || false
    }
  };

  var noBoard;

  if (userData && userData.settings) {
    noBoard = userData.settings.indexOf('noBoardReports') >= 0;
  }

  if (parameters.boardUri) {
    query.boardUri = parameters.boardUri;
    query.global = {
      $ne : true
    };
  } else if (!globalBoardModeration || noBoard) {
    query.global = true;
  }

  return query;

};

// Section 1: Closed reports {
exports.readClosedReports = function(parameters, userData, callback) {

  reports.find(exports.getQueryBlock(parameters, userData, true), {
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
    parameters.boardUri = parameters.boardUri;

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
        exports.readClosedReports(parameters, userData, callback);
      }
    });
  } else if (!isOnGlobalStaff) {
    callback(lang(language).errDeniedGlobalReportManagement);
  } else {
    exports.readClosedReports(parameters, userData, callback);
  }

};
// } Section 1: Closed reports

// Section 2: Create report {
exports.fetchEmails = function(req, report, mods, callback) {

  var matchBlock = {
    confirmed : true,
    settings : 'reportNotify',
    email : {
      $exists : true,
      $ne : null
    },
    login : {
      $in : mods
    }
  };

  if (report.category) {

    matchBlock.$or = [ {
      reportFilter : report.category
    }, {
      'reportFilter.0' : {
        $exists : false
      }
    } ];

  }

  users.aggregate([ {
    $match : matchBlock
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
    callback, asn) {

  var toAdd = {
    global : !!parameters.globalReport,
    boardUri : report.board,
    threadId : +report.thread,
    category : parameters.categoryReport,
    creation : new Date()
  };

  var readIp = logger.ip(req);

  if (readIp) {

    if (!asn) {

      return locationOps.getASN(readIp, function(error, readAsn) {
        exports.createReport(req, report, reportedContent, parameters,
            callback, readAsn || -1);
      });

    }

    if (asn !== -1) {
      toAdd.asn = asn;
    }
    toAdd.reporterId = readIp.join('.');

  } else if (req.bypassId) {
    toAdd.reporterId = req.bypassId;
  }

  if (parameters.reasonReport) {
    toAdd.reason = parameters.reasonReport;
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
    return cb();
  }

  var report = reportedContent.shift();

  if (allowBlockedToReport) {
    exports.findReportedContent(report, req, reportedContent, parameters, cb);
  } else {
    var uriToCheck = parameters.globalReport ? null : report.board;

    ipBan.checkForBan(req, uriToCheck, null,
        function checkedForBan(error, ban) {
          if (error || ban) {
            cb(error, ban);
          } else {
            exports.findReportedContent(report, req, reportedContent,
                parameters, cb);
          }
        });
  }

};

exports.checkReports = function(req, reportedContent, parameters, cb) {

  if (!Array.isArray(reportedContent)) {
    return cb();
  }

  var category = parameters.categoryReport;

  if (!reportCategories || reportCategories.indexOf(category) < 0) {
    delete parameters.categoryReport;
  }

  reportedContent = reportedContent.slice(0, 1000);

  if (reportedContent.length > 1 && !multipleReports) {
    cb(lang(req.language).errDeniedMultipleReports);
  } else {
    exports.iterateReports(req, reportedContent, parameters, cb);
  }

};

exports.report = function(req, reportedContent, parameters, captchaId, cb) {

  miscOps.sanitizeStrings(parameters, exports.reportArguments);

  if (noReportCaptcha) {
    return exports.checkReports(req, reportedContent, parameters, cb);
  }

  captchaOps.attemptCaptcha(captchaId, parameters.captchaReport, null,
      req.language, function solvedCaptcha(error) {

        if (error) {
          cb(error);
        } else {
          exports.checkReports(req, reportedContent, parameters, cb);
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

    var logMessage = pieces.startPiece.replace('{$login}',
        redactedModNames ? lang().guiRedactedName : userData.login);

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

exports.canApplyRangeBan = function(parameters, posting) {

  var rangeBan = +parameters.banType === 1 || +parameters.banType === 2;

  return rangeBan && posting.ip;

};

exports.insertNewReportedBan = function(parameters, userData, report, posting,
    knownIps, knownBypasses, callback) {

  var newBan = {
    reason : parameters.banReason,
    appliedBy : userData.login,
    expiration : parameters.expiration,
    boardUri : report.global ? undefined : posting.boardUri,
    warning : +parameters.banType === 4
  };

  if (+parameters.banType === 3 && posting.asn) {
    newBan.asn = posting.asn;
  } else if (!parameters.banType || newBan.warning) {

    if (posting.ip) {

      if (knownIps[posting.ip.join('.')]) {
        return callback();
      }

      knownIps[posting.ip.join('.')] = true;
      newBan.ip = posting.ip;
    } else {

      if (knownBypasses[posting.bypassId.toString()]) {
        return callback();
      }

      knownBypasses[posting.bypassId.toString()] = true;
      newBan.bypassId = posting.bypassId;
    }

  } else if (exports.canApplyRangeBan(parameters, posting)) {
    newBan.range = miscOps.getRange(posting.ip, +parameters.banType === 2);
  } else {
    return callback();
  }

  bans.insertOne(newBan, callback);

};

exports.applyReportBans = function(parameters, foundReports, userData,
    closureDate, callback, index, knownIps, knownBypasses) {

  if (index >= foundReports.length || parameters.banTarget !== 1) {
    return exports.logReportClosure(foundReports, userData, closureDate,
        callback);
  }

  index = index || 0;
  knownIps = knownIps || {};
  knownBypasses = knownBypasses || {};

  var report = foundReports[index];

  if (report.global && userData.globalRole > 2) {
    return exports.applyReportBans(parameters, foundReports, userData,
        closureDate, callback, ++index);
  }

  var colToUse = report.postId ? posts : threads;

  var query = {
    boardUri : report.boardUri,
    $or : [ {
      'ip.0' : {
        $exists : true
      }
    }, {
      bypassId : {
        $exists : true
      }
    } ],

  };

  var fieldToUse = report.postId ? 'postId' : 'threadId';

  query[fieldToUse] = report[fieldToUse];

  colToUse.findOne(query, function(error, posting) {

    if (error) {
      return callback(error);
    } else if (!posting) {
      return exports.applyReportBans(parameters, foundReports, userData,
          closureDate, callback, ++index);
    }

    // style exception, too simple
    exports.insertNewReportedBan(parameters, userData, report, posting,
        knownIps, knownBypasses, function(error) {

          if (error) {
            callback(error);
          } else {
            exports.applyReportBans(parameters, foundReports, userData,
                closureDate, callback, ++index, knownIps, knownBypasses);
          }

        });
    // style exception, too simple

  });

};

exports.buildBan = function(parameters, userData, report) {

  var newBan = {
    warning : +parameters.banType === 4,
    reason : parameters.banReason,
    appliedBy : userData.login,
    expiration : parameters.expiration,
    boardUri : report.global ? undefined : report.boardUri
  };

  var isIp = typeof report.reporterId === 'string';

  if (+parameters.banType === 3 && report.asn) {
    newBan.asn = report.asn;
  } else if (!parameters.banType || newBan.warning) {

    if (isIp) {
      newBan.ip = report.reporterId.split('.').map(function(item) {
        return +item;
      });
    } else {
      newBan.bypassId = report.reporterId;
    }

  } else if (+parameters.banType === 1 || +parameters.banType === 2 && isIp) {
    newBan.range = miscOps.getRange(report.reporterId.split('.').map(
        function(item) {
          return +item;
        }), +parameters.banType === 2);
  } else {
    return;
  }

  return newBan;

};

exports.applyReporterBans = function(parameters, foundReports, userData,
    closureDate, callback) {

  if (parameters.banTarget !== 2) {
    return exports.applyReportBans(parameters, foundReports, userData,
        closureDate, callback);
  }

  miscOps.sanitizeStrings(parameters, exports.closeArguments);

  var bansToAdd = [];

  for (var i = 0; i < foundReports.length; i++) {

    var report = foundReports[i];

    if (!report.reporterId) {
      continue;
    }

    var newBan = exports.buildBan(parameters, userData, report);

    if (newBan) {
      bansToAdd.push(newBan);
    }

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

    return exports.applyReporterBans(parameters, foundReports, userData,
        closureDate, callback);
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

  delOps.posting(userData, {
    action : 'delete'
  }, threadsToDelete, postsToDelete, language, function deleted(error) {

    if (error) {
      callback(error);
    } else {
      exports.applyReporterBans(parameters, foundReports, userData,
          closureDate, callback);
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

exports.getOrEntry = function(report, seenIps, seenBypasses, userQuery) {

  if (typeof report.reporterId === 'string') {
    var array = seenIps[report.boardUri || '.global'] || [];
    if (array.indexOf(report.reporterId) >= 0) {
      return true;
    }

    seenIps[report.boardUri || '.global'] = array;
    userQuery.reporterId = report.reporterId;
    array.push(report.reporterId);

  } else {

    var bypassArray = seenBypasses[report.boardUri || '.global'] || [];

    if (bypassArray.indexOf(report.reporterId.toString()) >= 0) {
      return true;
    }

    seenBypasses[report.boardUri || '.global'] = bypassArray;
    userQuery.reporterId = report.reporterId;
    bypassArray.push(report.reporterId.toString());

  }

};

exports.getQueryForAllReports = function(ids, foundReports) {

  var queryOr = [];

  var seenIps = {};
  var seenBypasses = {};

  for (var i = 0; i < foundReports.length; i++) {

    var report = foundReports[i];

    if (!report.reporterId) {
      continue;
    }

    var userQuery = {};

    if (exports.getOrEntry(report, seenIps, seenBypasses, userQuery)) {
      continue;
    }

    userQuery.global = report.global;

    if (!report.global) {
      userQuery.boardUri = report.boardUri;
    }

    queryOr.push(userQuery);

  }

  return !queryOr.length ? null : {
    _id : {
      $nin : ids
    },
    closedBy : null,
    $or : queryOr
  };

};

exports.getAllReports = function(parameters, foundReports, ids, userData,
    language, callback) {

  if (!parameters.closeAllFromReporter) {
    return exports.updateReports(parameters, foundReports, ids, userData,
        language, callback);
  }

  var query = exports.getQueryForAllReports(ids, foundReports);

  if (!query) {
    return exports.updateReports(parameters, foundReports, ids, userData,
        language, callback);
  }

  reports.find(query).toArray(
      function(error, newReports) {

        if (error) {
          return callback(error);
        } else if (!newReports.length) {
          return exports.updateReports(parameters, foundReports, ids, userData,
              language, callback);
        }

        foundReports = foundReports.concat(newReports);

        for (var i = 0; i < newReports.length; i++) {
          ids.push(newReports[i]._id);
        }

        exports.updateReports(parameters, foundReports, ids, userData,
            language, callback);

      });

};

exports.getBoardsForClosing = function(parameters, foundReports, ids, userData,
    foundClosed, foundOpen, foundBoardsUris, callback, language) {

  if (foundClosed && !foundOpen) {
    return callback(lang(language).errReportAlreadyClosed);
  }

  boards.find({
    boardUri : {
      $in : foundBoardsUris
    }
  }).toArray(
      function gotBoards(error, foundBoards) {
        if (error) {
          return callback(error);
        } else if (foundBoards.length < foundBoardsUris.length) {
          return callback(lang(language).errBoardNotFound);
        }

        for (var i = 0; i < foundBoards.length; i++) {

          if (!common.isInBoardStaff(userData, foundBoards[i])) {
            return callback(lang(language).errDeniedBoardReportManagement);
          }

        }

        exports.getAllReports(parameters, foundReports, ids, userData,
            language, callback);

      });

};

exports.closeFoundReports = function(parameters, ids, userData, foundReports,
    language, callback) {

  var foundBoardsUris = [];

  var isOnGlobalStaff = userData.globalRole <= miscOps.getMaxStaffRole();

  // Get boards for non-global reports, check if reports have been
  // already closed and global permissions

  var foundOpen = false;
  var foundClosed = false;

  for (var i = 0; i < foundReports.length; i++) {
    var report = foundReports[i];

    var alreadyIncluded = foundBoardsUris.indexOf(report.boardUri) > -1;

    if (report.closedBy) {
      foundClosed = true;
    } else {
      foundOpen = true;
    }
    if (report.global && !isOnGlobalStaff) {
      return callback(lang(language).errDeniedGlobalReportManagement);

    } else if (!report.global && !alreadyIncluded) {
      foundBoardsUris.push(report.boardUri);
    }

  }

  exports.getBoardsForClosing(parameters, foundReports, ids, userData,
      foundClosed, foundOpen, foundBoardsUris, callback, language);

};

exports.getCloseQuery = function(reportList) {

  var orList = [];

  for (var i = 0; i < reportList.length; i++) {

    var informedItem = reportList[i].split('-');

    if (informedItem.length < 4) {
      continue;
    }

    var toPush = {
      boardUri : informedItem[0],
      threadId : +informedItem[1],
      global : informedItem[3] === 'true' ? true : {
        $ne : true
      }
    };

    var informedPostId = +informedItem[2];

    if (informedPostId) {
      toPush.postId = informedPostId;
    } else {
      toPush.postId = {
        $exists : false
      };
    }

    orList.push(toPush);

  }

  return orList;

};

exports.closeReports = function(userData, parameters, language, callback) {

  parameters.banTarget = +parameters.banTarget;

  common.parseExpiration(parameters);

  var reportList = parameters.reports || [];

  var orList = exports.getCloseQuery(reportList);

  if (!orList.length) {
    return callback(lang(language).errNoReportsInformed);
  }

  reports.find({
    $or : orList
  }).toArray(
      function gotReports(error, foundReports) {

        if (error) {
          callback(error);
        } else if (!foundReports.length) {
          callback(lang(language).errReportNotFound);
        } else {

          var ids = [];

          for (var i = 0; i < foundReports.length; i++) {
            ids.push(foundReports[i]._id);
          }

          exports.closeFoundReports(parameters, ids, userData, foundReports,
              language, callback);
        }

      });

};
// } Section 3: Close report

// Section 4: Open reports {
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
    return callback();
  }

  posts.find({
    $or : postsOrArray
  }, {
    projection : generator.postModProjection
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
      projection : generator.postModProjection
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

exports.getReportsAssociations = function(foundReports, callback) {

  exports.associateContent(foundReports, function associatedContent(error) {

    if (error) {
      callback(error);
    } else {

      var boardList = {};

      for (var i = 0; i < foundReports.length; i++) {

        var associatedPost = foundReports[i].associatedPost;

        if (associatedPost) {
          boardList[associatedPost.boardUri] = true;
        }

      }

      boards.find({
        boardUri : {
          $in : Object.keys(boardList)
        }
      }, {
        projection : {
          _id : 0,
          ipSalt : 1,
          boardUri : 1
        }
      }).toArray(function gotBoards(error, foundBoards) {

        if (error) {
          return callback(error);
        }

        for (i = 0; i < foundBoards.length; i++) {
          var foundBoard = foundBoards[i];
          boardList[foundBoard.boardUri] = foundBoard;
        }

        callback(null, foundReports, boardList);

      });

    }

  });

};

exports.getOpenReports = function(userData, parameters, language, callback) {

  var globalStaff = userData.globalRole <= miscOps.getMaxStaffRole();

  if (!globalStaff && !parameters.boardUri) {
    return callback(lang(language).errDeniedGlobalReportManagement);
  } else if (parameters.boardUri && (!globalBoardModeration || !globalStaff)) {

    var allowedBoards = userData.ownedBoards || [];

    allowedBoards = allowedBoards.concat(userData.volunteeredBoards || []);

    if (allowedBoards.indexOf(parameters.boardUri) < 0) {
      return callback(lang(language).errDeniedBoardReportManagement);
    }
  }

  var query = exports.getQueryBlock(parameters, userData);

  if (parameters.categoryFilter) {

    query.category = {
      $in : parameters.categoryFilter
    };

  }

  reports.aggregate([ {
    $match : query
  }, {
    $group : {
      _id : {
        boardUri : '$boardUri',
        threadId : '$threadId',
        postId : '$postId',
        global : '$global'

      },
      total : {
        $sum : 1
      },
      creation : {
        $first : '$creation'
      },
      categories : {
        $addToSet : '$category'
      },
      reasons : {
        $addToSet : '$reason'
      }

    }
  }, {
    $project : {
      _id : 0,
      total : '$total',
      boardUri : '$_id.boardUri',
      threadId : '$_id.threadId',
      postId : '$_id.postId',
      global : '$_id.global',
      creation : '$creation',
      categories : '$categories',
      reasons : '$reasons'
    }
  }, {
    $sort : {
      creation : -1
    }
  } ]).toArray(function(error, foundReports) {

    if (error) {
      return callback(error);
    }

    for (var i = 0; i < foundReports.length; i++) {

      var indexToRemove = foundReports[i].categories.indexOf(null);

      if (indexToRemove > -1) {
        foundReports[i].categories.splice(indexToRemove, 1);
      }

    }

    if (parameters.json || !foundReports.length) {
      callback(null, foundReports);
    } else {
      exports.getReportsAssociations(foundReports, callback);
    }

  });

};
// } Section 4: Open reports
