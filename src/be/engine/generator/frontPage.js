'use strict';

var settingsHandler = require('../../settingsHandler');
var db = require('../../db');
var latestImagesCol = db.latestImages();
var latestPostsCol = db.latestPosts();
var uploadReferences = db.uploadReferences();
var boards = db.boards();
var rootModule;
var commonDomManipulator;
var jsonBuilder;
var domManipulator;
var globalLatestPosts;
var globalLatestImages;
var topBoardsCount;
var verbose;
var altLanguages;
var globalStats;

exports.loadSettings = function() {

  var settings = settingsHandler.getGeneralSettings();
  globalStats = settings.frontPageStats;
  verbose = settings.verbose || settings.verboseGenerator;
  altLanguages = settings.useAlternativeLanguages;
  topBoardsCount = settings.topBoardsCount;
  globalLatestPosts = settings.globalLatestPosts;
  globalLatestImages = settings.globalLatestImages;

};

exports.loadDependencies = function() {

  rootModule = require('.');
  jsonBuilder = require('../jsonBuilder');
  var rootDomManipulator = require('../domManipulator');
  commonDomManipulator = rootDomManipulator.common;
  domManipulator = rootDomManipulator.staticPages;

};

exports.saveFrontPageAlternativeHTML = function(foundBoards, globalLatestPosts,
    globalLatestImages, globalStats, mediaData, language, callback) {

  rootModule.nextLanguage(language, function gotNextLanguage(error, language) {

    if (error) {
      callback(error);
    } else if (!language) {
      jsonBuilder.frontPage(foundBoards, globalLatestPosts, globalLatestImages,
          globalStats, callback);
    } else {
      exports.saveFrontPage(foundBoards, globalLatestPosts, globalLatestImages,
          globalStats, mediaData, callback, language);
    }
  });

};

exports.saveFrontPage = function(foundBoards, globalLatestPosts,
    globalLatestImages, globalStats, mediaData, callback, language) {

  if ((globalStats || mediaData) && !language) {

    globalStats = globalStats || {};
    mediaData = mediaData || {};

    for ( var key in mediaData) {
      if (mediaData.hasOwnProperty(key)) {
        globalStats[key] = mediaData[key];
      }
    }

    if (globalStats.totalSize) {
      globalStats.totalSize = commonDomManipulator
          .formatFileSize(globalStats.totalSize);
    }
  }

  domManipulator.frontPage(foundBoards, globalLatestPosts, globalLatestImages,
      globalStats, language, function savedHtml(error) {
        if (error) {
          callback(error);
        } else {

          if (altLanguages) {

            exports.saveFrontPageAlternativeHTML(foundBoards,
                globalLatestPosts, globalLatestImages, globalStats, mediaData,
                language, callback);

          } else {
            jsonBuilder.frontPage(foundBoards, globalLatestPosts,
                globalLatestImages, globalStats, callback);
          }
        }

      });

};

exports.fetchGlobalStats = function(foundBoards, globalLatestPosts,
    globalLatestImages, callback) {

  if (!globalStats) {
    exports.saveFrontPage(foundBoards, globalLatestPosts, globalLatestImages,
        null, null, callback);

    return;
  }

  boards.aggregate([ {
    $project : {
      lastPostId : 1,
      uniqueIps : 1,
      postsPerHour : 1
    }
  }, {
    $group : {
      _id : 0,
      totalIps : {
        $sum : '$uniqueIps'
      },
      totalPosts : {
        $sum : '$lastPostId'
      },
      totalBoards : {
        $sum : 1
      },
      totalPPH : {
        $sum : '$postsPerHour'
      }
    }
  } ]).toArray(
      function gotBoardStats(error, results) {

        if (error) {
          callback(error);
        } else {

          // style exception, too simple
          uploadReferences.aggregate([ {
            $group : {
              _id : 0,
              totalFiles : {
                $sum : 1
              },
              totalSize : {
                $sum : '$size'
              }
            }
          } ]).toArray(
              function gotMediaStats(error, mediaResults) {

                if (error) {
                  callback(error);
                } else {
                  exports.saveFrontPage(foundBoards, globalLatestPosts,
                      globalLatestImages, results.length ? results[0] : null,
                      mediaResults.length ? mediaResults[0] : null, callback);
                }

              });
          // style exception, too simple

        }

      });

};

exports.fetchLatestGlobalImages = function(foundBoards, globalLatestPosts,
    callback) {

  if (!globalLatestImages) {

    exports.fetchGlobalStats(foundBoards, globalLatestPosts, null, callback);

    return;
  }

  latestImagesCol.find({}, {
    projection : {
      _id : 0,
      thumb : 1,
      creation : 1,
      boardUri : 1,
      threadId : 1,
      postId : 1
    }
  }).toArray(
      function gotImages(error, images) {

        if (error) {
          callback(error);
        } else {
          exports.fetchGlobalStats(foundBoards, globalLatestPosts,
              images.length ? images : null, callback);
        }

      });

};

exports.fetchLatestGlobalPosts = function(foundBoards, callback) {

  if (!globalLatestPosts) {
    exports.fetchLatestGlobalImages(foundBoards, null, callback);
    return;
  }

  latestPostsCol.find({}, {
    projection : {
      _id : 0,
      boardUri : 1,
      threadId : 1,
      postId : 1,
      creation : 1,
      previewText : 1
    }
  }).sort({
    creation : -1
  }).toArray(
      function gotLatestPosts(error, posts) {
        if (error) {
          callback(error);
        } else {
          exports.fetchLatestGlobalImages(foundBoards, posts.length ? posts
              : null, callback);
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
    projection : {
      boardUri : 1,
      _id : 0,
      boardName : 1
    }
  }).sort({
    uniqueIps : -1,
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