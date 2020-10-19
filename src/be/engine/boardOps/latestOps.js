'use strict';

var mongo = require('mongodb');
var ObjectID = mongo.ObjectID;
var logger = require('../../logger');
var db = require('../../db');
var bans = db.bans();
var boards = db.boards();
var posts = db.posts();
var threads = db.threads();
var miscOps;
var lang;
var latestLimit;
var clearIpMinRole;
var generator;
var unlockHistory;
var disableLatestPostings;

exports.loadDependencies = function() {

  generator = require('../generator');
  miscOps = require('../miscOps');
  lang = require('../langOps').languagePack;

};

exports.loadSettings = function() {

  var settings = require('../../settingsHandler').getGeneralSettings();
  latestLimit = settings.latestPostsAmount;
  unlockHistory = settings.unlockHistory;
  clearIpMinRole = settings.clearIpMinRole;
  disableLatestPostings = settings.disableLatestPostings;

};

exports.mergeFoundPostings = function(foundPostings, checkPostings, callback) {

  checkPostings = checkPostings.sort(function(a, b) {
    return b.creation - a.creation;
  });

  checkPostings = checkPostings.splice(0, latestLimit + 1);

  var pivotPosting = checkPostings[checkPostings.length - 1];

  var boardList = {};

  for (var i = 0; i < foundPostings.length; i++) {
    boardList[foundPostings[i].boardUri] = true;
  }

  boards.find({
    boardUri : {
      $in : Object.keys(boardList)
    }
  }, {
    projection : {
      boardUri : 1,
      _id : 0,
      ipSalt : 1
    }
  }).toArray(function gotBoards(error, foundBoards) {

    if (error) {
      return callback(error);
    }

    for (i = 0; i < foundBoards.length; i++) {
      var foundBoard = foundBoards[i];
      boardList[foundBoard.boardUri] = foundBoard;
    }

    callback(null, foundPostings, pivotPosting, boardList);

  });

};

exports.getUpperLimit = function(matchBlock, foundPostings, callback) {

  if (!foundPostings.length) {
    return callback(null, foundPostings);
  }

  matchBlock.creation = {
    $lt : foundPostings[foundPostings.length - 1].creation
  };

  posts.find(matchBlock, {
    projection : generator.postProjection
  }).sort({
    creation : -1
  }).limit(latestLimit + 1).toArray(
      function gotPosts(error, foundPosts) {

        if (error) {
          return callback(error);
        }

        threads.find(matchBlock, {
          projection : generator.postProjection
        }).sort({
          creation : -1
        }).limit(latestLimit + 1).toArray(
            function gotThreads(error, foundThreads) {

              if (error) {
                return callback(error);
              }

              exports.mergeFoundPostings(foundPostings, foundPosts
                  .concat(foundThreads), callback);

            });

      });

};

exports.getPosts = function(hasDate, matchBlock, callback) {

  var sortDirection = hasDate ? 1 : -1;

  posts.find(matchBlock, {
    projection : generator.postModProjection
  }).sort({
    creation : sortDirection
  }).limit(latestLimit).toArray(function gotPosts(error, foundPosts) {

    if (error) {
      return callback(error);
    }

    // style exception, too simple
    threads.find(matchBlock, {
      projection : generator.postModProjection
    }).sort({
      creation : sortDirection
    }).limit(latestLimit).toArray(function gotThreads(error, foundThreads) {

      if (error) {
        return callback(error);
      }

      var foundPostings = foundPosts.concat(foundThreads);

      if (hasDate) {
        foundPostings = foundPostings.sort(function(a, b) {
          return a.creation - b.creation;
        }).splice(0, latestLimit);
      }

      foundPostings = foundPostings.sort(function(a, b) {
        return b.creation - a.creation;
      });

      if (!hasDate) {
        foundPostings = foundPostings.splice(0, latestLimit);
      }

      exports.getUpperLimit(matchBlock, foundPostings, callback);

    });
    // style exception, too simple

  });

};

exports.fetchPostInfo = function(matchBlock, globalStaff, parameters, cb) {

  var query = {
    boardUri : parameters.boardUri
  };

  var collectionToUse;

  if (parameters.threadId) {
    collectionToUse = threads;
    query.threadId = +parameters.threadId;
  } else {
    collectionToUse = posts;
    query.postId = +parameters.postId;
  }

  collectionToUse.findOne(query, {
    projection : {
      ip : 1,
      bypassId : 1,
      boardUri : 1
    }
  }, function gotPosting(error, posting) {

    if (error) {
      return cb(error);
    }

    if (posting && (posting.ip || posting.bypassId)) {

      var orList = [];

      matchBlock.$or = orList;

      if (posting.ip) {
        orList.push({
          ip : posting.ip
        });
      }

      if (posting.bypassId) {
        orList.push({
          bypassId : posting.bypassId
        });
      }

      if (!globalStaff && !unlockHistory) {
        matchBlock.boardUri = posting.boardUri;
      }
    }

    cb(null, matchBlock);

  });

};

exports.canSearchPerPost = function(parameters, userData) {

  if (!parameters.boardUri || (!parameters.threadId && !parameters.postId)) {
    return false;
  }

  if (userData.globalRole <= miscOps.getMaxStaffRole()) {
    return true;
  }

  var allowedBoards = userData.ownedBoards || [];

  allowedBoards = allowedBoards.concat(userData.volunteeredBoards || []);

  return allowedBoards.indexOf(parameters.boardUri) >= 0;

};

exports.canSearchPerBan = function(ban, userData) {

  if (!ban || (!ban.ip && !ban.bypassId)) {
    return false;
  }

  if (userData.globalRole <= miscOps.getMaxStaffRole()) {
    return true;
  }

  if (!ban.boardUri) {
    return false;
  }

  var allowedBoards = userData.ownedBoards || [];

  allowedBoards = allowedBoards.concat(userData.volunteeredBoards || []);

  return allowedBoards.indexOf(ban.boardUri) >= 0;

};

exports.getBoardsToShow = function(parameters, userData) {

  parameters.boards = (parameters.boards || '').split(',').map(
      function(element) {
        return element.trim();
      });

  for (var i = parameters.boards.length; i >= 0; i--) {
    if (!parameters.boards[i]) {
      parameters.boards.splice(i, 1);
    }
  }

  if (userData.globalRole <= miscOps.getMaxStaffRole()) {
    return parameters.boards.length ? parameters.boards : null;
  } else {

    var allowedBoards = userData.ownedBoards || [];

    allowedBoards = allowedBoards.concat(userData.volunteeredBoards || []);

    var boardsToShow = [];

    for (i = 0; i < parameters.boards.length; i++) {

      if (allowedBoards.indexOf(parameters.boards[i]) >= 0) {
        boardsToShow.push(parameters.boards[i]);
      }
    }

    return boardsToShow.length ? boardsToShow : allowedBoards;

  }

};

exports.setDate = function(parameters) {

  if (!parameters.date) {
    return;
  }

  var parsedDate = +parameters.date;

  if (parsedDate) {
    parsedDate = new Date(parsedDate);
  } else {
    parsedDate = new Date(parameters.date);
  }

  if (!parsedDate.getDate()) {
    delete parameters.date;
  } else {
    parameters.date = parsedDate;
  }

};

exports.setIpAndPostMatch = function(parameters, matchBlock, userData, cb) {

  if (parameters.ip && userData.globalRole <= clearIpMinRole) {
    matchBlock.ip = logger.convertIpToArray(parameters.ip);
    delete parameters.boardUri;
  } else if (exports.canSearchPerPost(parameters, userData)) {
    return exports.fetchPostInfo(matchBlock, userData.globalRole <= miscOps
        .getMaxStaffRole(), parameters, cb);
  }

  cb(null, matchBlock);

};

exports.getMatchBlock = function(parameters, userData, callback) {

  var matchBlock = parameters.date ? {
    creation : {
      $gt : parameters.date
    }
  } : {};

  var boardsToShow = exports.getBoardsToShow(parameters, userData);

  if (boardsToShow) {
    matchBlock.boardUri = {
      $in : boardsToShow
    };
  }

  if (!parameters.banId) {
    return exports
        .setIpAndPostMatch(parameters, matchBlock, userData, callback);
  }

  try {
    var banId = new ObjectID(parameters.banId);
  } catch (error) {
    return callback(null, matchBlock);
  }

  bans.findOne({
    _id : banId
  }, function(error, ban) {

    if (error) {
      return callback(error);
    }

    if (exports.canSearchPerBan(ban, userData)) {

      var globalStaff = userData.globalRole <= miscOps.getMaxStaffRole();

      if (!globalStaff && !unlockHistory) {
        matchBlock.boardUri = ban.boardUri;
      }

      var orList = [];

      matchBlock.$or = orList;

      if (ban.ip) {
        orList.push({
          ip : ban.ip
        });
      }

      if (ban.bypassId) {
        orList.push({
          bypassId : ban.bypassId
        });
      }

    }

    callback(null, matchBlock);

  });

};

exports.getLatestPostings = function(userData, parameters, language, callback) {

  if (disableLatestPostings) {
    return callback(lang(language).errDisabledLatestPostings);
  }

  exports.setDate(parameters);

  exports.getMatchBlock(parameters, userData, function gotMatchBlock(error,
      matchBlock) {

    exports.getPosts(!!parameters.date, matchBlock, callback);
  });

};
