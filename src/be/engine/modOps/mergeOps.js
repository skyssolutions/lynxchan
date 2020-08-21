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
var logOps;

var extraCols = [ db.reports(), db.latestPosts(), db.latestImages() ];

exports.fieldsToCopy = [ 'name', 'hash', 'asn', 'signedRole', 'password',
    'email', 'flag', 'bypassId', 'flagName', 'flagCode', 'subject', 'ip',
    'message', 'markdown', 'banMessage', 'creation', 'boardUri',
    'lastEditTime', 'lastEditLogin', 'files' ];

exports.loadSettings = function() {
  var settings = settingsHandler.getGeneralSettings();
  verbose = settings.verbose || settings.verboseMisc;
};

exports.loadDependencies = function() {
  delOps = require('../deletionOps').postingDeletions;
  lang = require('../langOps').languagePack;
  miscOps = require('../miscOps');
  logOps = require('../logOps');
};

exports.updateExtraCols = function(parameters, userData, callback, index) {

  index = index || 0;

  if (index >= extraCols.length) {
    return delOps.updateBoardAndThreads(parameters, {}, callback,
        [ +parameters.threadSource ], [], [ +parameters.threadDestination ]);
  }

  extraCols[index].bulkWrite([ {
    updateMany : {
      filter : {
        boardUri : parameters.boardUri,
        threadId : +parameters.threadSource,
        postId : null
      },
      update : {
        $set : {
          threadId : +parameters.threadDestination,
          postId : +parameters.threadSource
        }
      }
    }
  }, {
    updateMany : {
      filter : {
        boardUri : parameters.boardUri,
        threadId : +parameters.threadSource
      },
      update : {
        $set : {
          threadId : +parameters.threadDestination
        }
      }
    }
  } ], function(error) {

    if (error && verbose) {
      console.log(error);
    }

    exports.updateExtraCols(parameters, userData, callback, ++index);

  });

};

exports.createRedirects = function(parameters, userData, callback) {

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

  redirects.insertMany(newRedirects, function(error) {

    if (error && verbose) {
      console.log(error);
    }

    exports.updateExtraCols(parameters, userData, callback);

  });

};

exports.addLogEntry = function(parameters, userData, callback) {

  var message = lang().logThreadMerge.replace('{$origin}',
      parameters.boardUri + '/' + parameters.threadSource).replace(
      '{$destination}',
      parameters.boardUri + '/' + parameters.threadDestination);

  logOps.insertLog({
    user : userData.login,
    type : 'threadMerge',
    time : new Date(),
    boardUri : parameters.boardUri,
    description : message
  }, function() {

    exports.createRedirects(parameters, userData, callback);

  });

};

exports.cleanOldThread = function(parameters, userData, callback) {

  threads.findOneAndDelete({
    boardUri : parameters.boardUri,
    threadId : +parameters.threadSource
  }, function(error, result) {

    if (error && verbose) {
      console.log(error);
    }

    if (!result.value) {
      return exports.createRedirects(parameters, userData, callback);
    }

    var newPost = {
      threadId : +parameters.threadDestination,
      postId : +parameters.threadSource
    };

    for (var i = 0; i < exports.fieldsToCopy.length; i++) {
      newPost[exports.fieldsToCopy[i]] = result.value[exports.fieldsToCopy[i]];
    }

    // style exception, too simple
    posts.insertOne(newPost, function(error) {

      if (error && verbose) {
        console.log(error);
      }

      exports.addLogEntry(parameters, userData, callback);

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
