'use strict';

var settingsHandler = require('../../settingsHandler');
var db = require('../../db');
var boards = db.boards();
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

exports.performMerge = function(parameters, userData, callback) {

  posts.updateMany({
    boardUri : parameters.boardUri,
    threadId : +parameters.threadSource
  }, {
    $set : {
      threadId : +parameters.threadDestination
    },
    $unset : miscOps.individualCaches
  }, function(error) {

    if (error) {
      return callback(error);
    }

    // style exception, too simple
    threads.removeOne({
      boardUri : parameters.boardUri,
      threadId : +parameters.threadSource
    }, function(error) {

      if (error && verbose) {
        console.log(error);
      }

      exports.updateExtraCols(parameters, userData, callback);

    });
    // style exception, too simple

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
