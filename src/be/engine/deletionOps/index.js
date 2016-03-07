'use strict';

exports.miscDeletions = require('./miscDelOps');
exports.postingDeletions = require('./postingDelOps');
var db = require('../../db');
var posts = db.posts();
var threads = db.threads();
var lang;
var miscOps;
var clearIpMinRole;

exports.loadSettings = function() {
  var settings = require('../../settingsHandler').getGeneralSettings();

  clearIpMinRole = settings.clearIpMinRole;
  exports.miscDeletions.loadSettings();
  exports.postingDeletions.loadSettings();

};

exports.loadDependencies = function() {

  miscOps = require('../miscOps');
  lang = require('../langOps').languagePack();
  exports.miscDeletions.loadDependencies();
  exports.postingDeletions.loadDependencies();

};

exports.deleteFromIp = function(parameters, userData, callback) {

  var allowed = userData.globalRole <= clearIpMinRole;

  if (!allowed) {

    callback(lang.errDeniedIpDeletion);

    return;
  }

  var processedIp = miscOps.sanitizeIp(parameters.ip);

  var queryBlock = {
    ip : processedIp
  };

  if (parameters.boards) {

    var matches = parameters.boards.toString().match(/\w+/g);

    if (matches) {

      queryBlock.boardUri = {
        $in : matches
      };
    }
  }

  threads.aggregate([ {
    $match : queryBlock
  }, {
    $project : {
      boardUri : 1,
      threadId : 1
    }
  }, {
    $group : {
      _id : '$boardUri',
      threads : {
        $push : '$threadId'
      }
    }
  } ], function gotThreads(error, results) {

    if (error) {
      callback(error);
    } else {

      var foundThreads = {};

      for (var i = 0; i < results.length; i++) {

        var result = results[i];

        foundThreads[result._id] = result.threads;

      }

      // style exception, too simple
      posts.aggregate([ {
        $match : queryBlock
      }, {
        $project : {
          boardUri : 1,
          postId : 1
        }
      }, {
        $group : {
          _id : '$boardUri',
          posts : {
            $push : '$postId'
          }
        }
      } ], function gotPosts(error, results) {
        if (error) {
          callback(error);
        } else {

          var foundPosts = {};

          for (var i = 0; i < results.length; i++) {

            var result = results[i];

            foundPosts[result._id] = result.posts;

          }

          exports.postingDeletions.posting(userData, parameters, foundThreads,
              foundPosts, callback);

        }
      });
      // style exception, too simple

    }

  });

};