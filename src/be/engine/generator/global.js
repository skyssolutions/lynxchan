'use strict';

// handles generation of pages not specific to any board

var mongo = require('mongodb');
var ObjectID = mongo.ObjectID;
var db = require('../../db');
var logs = db.logs();
var aggregatedLogs = db.aggregatedLogs();
var overboard = db.overboardThreads();
var threads = db.threads();
var posts = db.posts();
var boards = db.boards();
var latestPostsCol = db.latestPosts();
var boot = require('../../boot');
var settingsHandler = require('../../settingsHandler');
var settings = settingsHandler.getGeneralSettings();
var topBoardsCount = settings.topBoardsCount;
var templateSettings = settingsHandler.getTemplateSettings();
var verbose = settings.verbose;
var globalLatestPosts = settings.globalLatestPosts;
var domManipulator;
var postProjection;
var threadProjection;
var jsonBuilder;
var gfsHandler;
var miscOps;

exports.loadDependencies = function() {

  var rootModule = require('.');
  postProjection = rootModule.postProjection;
  threadProjection = rootModule.threadProjection;
  domManipulator = require('../domManipulator').staticPages;
  gfsHandler = require('../gridFsHandler');
  miscOps = require('../miscOps');
  jsonBuilder = require('../jsonBuilder');

};

exports.maintenance = function(callback) {

  if (verbose) {
    console.log('Generating maintenance page');
  }

  domManipulator.maintenance(callback);

};

exports.login = function(callback) {
  if (verbose) {
    console.log('Generating login page');
  }

  domManipulator.login(callback);

};

exports.audioThumb = function(callback) {

  if (verbose) {
    console.log('Saving audio thumb image');
  }

  var filePath = settingsHandler.getFePath() + '/templates/';
  filePath += templateSettings.audioThumb;

  gfsHandler.writeFile(filePath, boot.genericAudioThumb(), miscOps.getMime(boot
      .genericAudioThumb()), {}, callback);

};

exports.spoiler = function(callback) {

  if (verbose) {
    console.log('Saving spoiler image');
  }

  var filePath = settingsHandler.getFePath() + '/templates/';
  filePath += templateSettings.spoiler;

  gfsHandler.writeFile(filePath, boot.spoilerImage(), miscOps.getMime(boot
      .spoilerImage()), {}, callback);

};

exports.defaultBanner = function(callback) {

  if (verbose) {
    console.log('Saving default banner');
  }

  var filePath = settingsHandler.getFePath() + '/templates/';
  filePath += templateSettings.defaultBanner;

  gfsHandler.writeFile(filePath, boot.defaultBanner(), miscOps.getMime(boot
      .defaultBanner()), {
    status : 200
  }, callback);
};

exports.thumb = function(callback) {

  if (verbose) {
    console.log('Saving generic thumbnail');
  }

  var filePath = settingsHandler.getFePath() + '/templates/';
  filePath += templateSettings.thumb;

  gfsHandler.writeFile(filePath, boot.genericThumb(), miscOps.getMime(boot
      .genericThumb()), {}, callback);
};

exports.notFound = function(callback) {

  if (verbose) {
    console.log('Generating 404 page');
  }

  domManipulator.notFound(callback);

};

// Section 1: Front-page {
exports.saveFrontPage = function(foundBoards, globalLatestPosts, callback) {

  domManipulator.frontPage(foundBoards, globalLatestPosts, function savedHtml(
      error) {
    if (error) {
      callback(error);
    } else {
      jsonBuilder.frontPage(foundBoards, globalLatestPosts, callback);
    }

  });

};

exports.fetchLatestGlobalPosts = function(foundBoards, callback) {

  if (!globalLatestPosts) {
    exports.saveFrontPage(foundBoards, null, callback);
    return;
  }

  latestPostsCol.find({}, {
    _id : 0,
    boardUri : 1,
    threadId : 1,
    postId : 1,
    creation : 1,
    previewText : 1
  }).sort({
    creation : -1
  }).toArray(
      function gotLatestPosts(error, posts) {
        if (error) {
          callback(error);
        } else {
          exports.saveFrontPage(foundBoards, posts.length ? posts : null,
              callback);
        }
      });

};

exports.frontPage = function(callback) {

  if (verbose) {
    console.log('Generating front-page');
  }

  if (!topBoardsCount) {
    exports.fetchLatestGlobalPosts(null, callback);
    return;
  }

  boards.find({
    settings : {
      $not : {
        $elemMatch : {
          $in : [ 'unindex' ]
        }
      }
    }
  }, {
    boardUri : 1,
    _id : 0,
    boardName : 1
  }).sort({
    postsPerHour : -1,
    lastPostId : -1,
    boardUri : 1
  }).limit(topBoardsCount).toArray(function(error, foundBoards) {
    if (error) {
      callback(error);
    } else {
      exports.fetchLatestGlobalPosts(foundBoards, callback);
    }
  });

};
// } Section 1: Front-page

// Section 2: Overboard {
exports.getOverboardPosts = function(foundThreads, callback) {

  var previewRelation = {};

  for (var i = 0; i < foundThreads.length; i++) {

    var thread = foundThreads[i];

    var boardUri = thread.boardUri;

    var previewArray = previewRelation[boardUri] || [];

    previewArray = previewArray.concat(thread.latestPosts);

    previewRelation[boardUri] = previewArray;
  }

  var orArray = [];

  for ( var key in previewRelation) {

    orArray.push({
      boardUri : key,
      postId : {
        $in : previewRelation[key]
      }
    });
  }

  posts.find({
    $or : orArray
  }, postProjection).sort({
    creation : 1
  }).toArray(
      function gotPosts(error, foundPosts) {
        if (error) {
          callback(error);
        } else {

          var previewRelation = {};

          for (var i = 0; i < foundPosts.length; i++) {

            var post = foundPosts[i];

            var boardElement = previewRelation[post.boardUri] || {};

            previewRelation[post.boardUri] = boardElement;

            var threadArray = boardElement[post.threadId] || [];

            threadArray.push(post);

            boardElement[post.threadId] = threadArray;

          }

          // style exception, too simple
          domManipulator.overboard(foundThreads, previewRelation,
              function rebuildHtml(error) {
                if (error) {
                  callback(error);
                } else {
                  jsonBuilder
                      .overboard(foundThreads, previewRelation, callback);
                }
              });
          // style exception, too simple

        }

      });

};

exports.getOverboardThreads = function(ids, callback) {

  threads.find({
    _id : {
      $in : ids
    }
  }, threadProjection).sort({
    lastBump : -1
  }).limit(settings.overBoardThreadCount).toArray(
      function gotThreads(error, foundThreads) {
        if (error) {
          callback(error);
        } else if (!foundThreads.length) {
          callback();
        } else {
          exports.getOverboardPosts(foundThreads, callback);
        }
      });

};

exports.overboard = function(callback) {

  if (!settings.overboard) {
    callback();
    return;
  }

  if (verbose) {
    console.log('Building overboard');
  }

  overboard.find({}, {
    _id : 0,
    thread : 1
  }).toArray(function gotOverBoardThreads(error, foundOverboardThreads) {
    if (error) {
      callback(error);
    } else {

      var ids = [];

      for (var i = 0; i < foundOverboardThreads.length; i++) {
        ids.push(new ObjectID(foundOverboardThreads[i].thread));
      }

      exports.getOverboardThreads(ids, callback);

    }
  });

};
// } Section 2: Overboard

// Section 3: Logs {
exports.createLogPage = function(date, foundLogs, callback) {

  domManipulator.log(date, foundLogs, function createdPage(error) {

    if (error) {
      callback(error);
    } else {
      jsonBuilder.log(date, foundLogs, callback);
    }

  });

};

exports.log = function(date, callback, logData) {

  if (!logData) {

    if (!date) {
      if (settings.verbose) {

        console.log('Could not build log page, no data.');
      }

      callback();
      return;
    }

    aggregatedLogs.findOne({
      date : date
    }, function gotLogData(error, data) {

      if (error) {
        callback(error);
      } else if (!data) {

        if (verbose) {
          console.log('Could not find logs for ' + date);
        }

        callback();
      } else {
        exports.log(null, callback, data);
      }

    });

    return;
  }

  if (verbose) {
    console.log('Building log page for ' + logData.date);
  }

  var toFind = [];

  for (var i = 0; i < logData.logs.length; i++) {
    toFind.push(new ObjectID(logData.logs[i]));
  }

  logs.find({
    _id : {
      $in : toFind
    }
  }, {
    _id : 0,
    type : 1,
    user : 1,
    time : 1,
    boardUri : 1,
    description : 1,
    global : 1
  }).sort({
    time : 1
  }).toArray(function gotLogs(error, foundLogs) {

    if (error) {
      callback(error);
    } else {
      exports.createLogPage(logData.date, foundLogs, callback);
    }

  });

};

exports.iterateLogs = function(foundAggregatedLogs, callback) {

  if (!foundAggregatedLogs.length) {
    callback();
    return;
  }

  exports.log(null, function generatedLog(error) {

    if (error) {
      callback(error);
    } else {
      exports.iterateLogs(foundAggregatedLogs, callback);
    }

  }, foundAggregatedLogs.pop());

};

exports.logs = function(callback) {

  aggregatedLogs.find({}, {
    _id : 0,
    logs : 1,
    date : 1
  }).toArray(function gotLogs(error, foundAggregatedLogs) {

    if (error) {
      callback(error);
    } else {
      exports.iterateLogs(foundAggregatedLogs, callback);
    }

  });

};
// } Section 3: Logs
