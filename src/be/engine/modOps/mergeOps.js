'use strict';

var settingsHandler = require('../../settingsHandler');
var db = require('../../db');
var boards = db.boards();
var redirects = db.redirects();
var threads = db.threads();
var posts = db.posts();
var lang;
var miscOps;
var delOps;
var verbose;

var extraCols = [ db.reports(), db.latestPosts(), db.latestImages() ];

exports.loadSettings = function() {
  var settings = settingsHandler.getGeneralSettings();
  verbose = settings.verbose || settings.verboseMisc;
};

exports.loadDependencies = function() {
  delOps = require('../deletionOps').postingDeletions;
  lang = require('../langOps').languagePack;
  miscOps = require('../miscOps');
};

exports.updateExtraCols = function(parameters, userData, callback, index) {

  index = index || 0;

  if (index >= extraCols.length) {
    return delOps.updateBoardAndThreads(parameters, {}, callback,
        [ +parameters.threadSource ], [], [ +parameters.threadDestination ]);
  }

  extraCols[index].removeMany({
    boardUri : parameters.boardUri,
    threadId : +parameters.threadSource,
    postId : null
  }, function(error) {

    if (error && verbose) {
      console.log(error);
    }

    // style exception, too simple
    extraCols[index].updateMany({
      boardUri : parameters.boardUri,
      threadId : +parameters.threadSource
    }, {
      $set : {
        threadId : +parameters.threadDestination
      }
    }, function(error) {

      if (error && verbose) {
        console.log(error);
      }

      exports.updateExtraCols(parameters, userData, callback, ++index);

    });
    // style exception, too simple

  });

};

exports.cleanOldThread = function(parameters, userData, callback) {

  threads.removeOne({
    boardUri : parameters.boardUri,
    threadId : +parameters.threadSource
  }, function(error) {

    if (error && verbose) {
      console.log(error);
    }

    var redirectExpiration = new Date();
    redirectExpiration.setUTCDate(redirectExpiration.getUTCDate() + 1);

    var newRedirects = [];

    var originBoiler = '/' + parameters.boardUri + '/res/';
    originBoiler += +parameters.threadSource;

    var destinationBoiler = '/' + parameters.boardUri + '/res/';
    destinationBoiler += +parameters.threadDestination;

    for (var i = 0; i < 2; i++) {

      var extension = [ '.html', '.json' ][i];

      newRedirects.push({
        origin : originBoiler + extension,
        expiration : redirectExpiration,
        destination : destinationBoiler + extension
      });

    }

    // style exception, too simple
    redirects.insertMany(newRedirects, function(error) {

      if (error && verbose) {
        console.log(error);
      }

      exports.updateExtraCols(parameters, userData, callback);

    });
    // style exception, too simple

  });

};

exports.getPostsOps = function(foundPosts, parameters) {

  var ops = [];

  var matchRegex = '<a class="quoteLink" href="\/';
  matchRegex += parameters.boardUri;
  matchRegex += '\/res\/' + (+parameters.threadSource);
  matchRegex += '\.html#\\d+">&gt;&gt;\\d+<\/a>';

  var replaceFunction = function(match) {

    var newString = '/res/' + (+parameters.threadDestination);

    return match.replace('/res/' + (+parameters.threadSource), newString);
  };

  for (var i = 0; i < foundPosts.length; i++) {

    var post = foundPosts[i];

    ops.push({
      updateOne : {
        filter : {
          _id : post._id
        },
        update : {
          $set : {
            markdown : post.markdown.replace(new RegExp(matchRegex, 'g'),
                replaceFunction),
            threadId : +parameters.threadDestination
          },
          $unset : miscOps.individualCaches
        }
      }
    });

  }

  return ops;

};

exports.performMerge = function(parameters, userData, callback) {

  posts.find({
    boardUri : parameters.boardUri,
    threadId : +parameters.threadSource
  }, {
    projection : {
      markdown : 1
    }
  }).toArray(function(error, foundPosts) {

    if (error) {
      return callback(error);
    } else if (!foundPosts.length) {
      return exports.cleanOldThread(parameters, userData, callback);
    }

    var ops = exports.getPostsOps(foundPosts, parameters);

    posts.bulkWrite(ops, function(error) {

      if (error) {
        callback(error);
      } else {
        exports.cleanOldThread(parameters, userData, callback);
      }

    });

  });

};

exports.getError = function(foundThreads, parameters, language) {

  var matchesSource = foundThreads[0].threadId === +parameters.sourceThread;

  var errorKey = matchesSource ? 'errDestinationThreadNotFound'
      : 'errSourceThreadNotFound';

  return lang(language)[errorKey];

};

exports.findThreads = function(parameters, userData, language, callback) {

  threads.find({
    threadId : {
      $in : [ +parameters.threadSource, +parameters.threadDestination ]
    },
    archived : {
      $ne : true
    },
    boardUri : parameters.boardUri
  }, {
    projection : {
      page : 1,
      threadId : 1,
      _id : 0
    }
  }).toArray(function(error, foundThreads) {

    if (error) {
      return callback(error);
    } else if (foundThreads.length < 2) {

      if (!foundThreads.length) {
        callback(lang(language).errSourceThreadNotFound);
      } else {
        callback(exports.getError(foundThreads, parameters, language));
      }

      return;
    }

    exports.performMerge(parameters, userData, callback);

  });

};

exports.merge = function(parameters, userData, language, callback) {

  boards.findOne({
    boardUri : parameters.boardUri
  }, function(error, boardData) {

    if (error) {
      return callback(lang(language).errBoardNotFound);
    } else if (!delOps.isAllowedByStaffPower(userData, boardData)) {
      return callback(lang(language).errDeniedThreadManagement);
    }

    exports.findThreads(parameters, userData, language, callback);

  });

};
