'use strict';

// handles generation control of pages specific to a board

var db = require('../../db');
var boards = db.boards();
var flags = db.flags();
var threads = db.threads();
var posts = db.posts();
var settingsHandler = require('../../settingsHandler');
var pageSize;
var verbose;
var domManipulator;
var altLanguages;
var postProjection;
var threadProjection;
var rootModule;
var boardOps;
var rssBuilder;
var jsonBuilder;
var latestLimit;
var maxThreads;
var latestPinned;
var disableCatalogPosting;

exports.boardProjection = {
  boardUri : 1,
  threadCount : 1,
  boardName : 1,
  maxFiles : 1,
  maxFileSizeMB : 1,
  captchaMode : 1,
  boardMarkdown : 1,
  usesCustomJs : 1,
  usesCustomCss : 1,
  settings : 1,
  boardDescription : 1,
  preferredLanguage : 1,
  locationFlagMode : 1,
  acceptedMimes : 1
};

var boardModFields = [ 'owner', 'ipSalt', 'volunteers' ];

exports.boardModProjection = JSON
    .parse(JSON.stringify(exports.boardProjection));

for (var i = 0; i < boardModFields.length; i++) {
  exports.boardModProjection[boardModFields[i]] = 1;
}

exports.loadSettings = function() {

  var settings = settingsHandler.getGeneralSettings();
  pageSize = settings.pageSize;
  latestPinned = settings.latestPostPinned;
  latestLimit = settings.latestPostsAmount;
  altLanguages = settings.useAlternativeLanguages;
  verbose = settings.verbose || settings.verboseGenerator;
  disableCatalogPosting = settings.disableCatalogPosting;
  maxThreads = settings.maxThreadCount;

};

exports.loadDependencies = function() {

  rootModule = require('.');
  postProjection = rootModule.postProjection;
  threadProjection = rootModule.threadProjection;
  boardOps = require('../boardOps').rules;
  domManipulator = require('../domManipulator').staticPages;
  jsonBuilder = require('../jsonBuilder');
  rssBuilder = require('../rssBuilder');

};

// Section 1: Thread {
exports.getThreadNextLanguage = function(boardData, flagData, threadData,
    foundPosts, lastPosts, language, callback) {

  rootModule.nextLanguage(language, function gotNextLanguage(error, language) {

    if (error) {
      callback(language);
    } else if (!language) {
      callback();
    } else {
      exports.generateThreadHTML(boardData, flagData, threadData, foundPosts,
          lastPosts, callback, language);
    }

  });

};

exports.generateThreadHTML = function(boardData, flagData, threadData,
    foundPosts, lastPosts, callback, language) {

  domManipulator.thread(boardData, flagData, threadData, foundPosts,
      function generatedHTML(error) {

        if (error) {
          callback(error);
        } else {

          domManipulator.thread(boardData, flagData, threadData, lastPosts,
              function generatedHTML(error) {

                if (!altLanguages) {
                  return callback();
                }

                exports.getThreadNextLanguage(boardData, flagData, threadData,
                    foundPosts, lastPosts, language, callback);

              }, null, null, language, true);

        }

      }, null, null, language);

};

exports.thread = function(boardUri, threadId, callback, boardData, threadData,
    flagData) {

  if (!flagData) {

    return flags.find({
      boardUri : boardUri
    }, {
      projection : {
        name : 1
      }
    }).sort({
      name : 1
    }).toArray(
        function gotFlags(error, foundFlags) {
          if (error) {
            callback(error);
          } else {
            exports.thread(boardUri, threadId, callback, boardData, threadData,
                foundFlags);
          }

        });

  } else if (!boardData) {

    return boards.findOne({
      boardUri : boardUri
    }, {
      projection : exports.boardProjection
    }, function gotBoard(error, board) {
      if (error) {
        callback(error);
      } else if (!board) {
        callback('Board not found');
      } else {
        exports.thread(boardUri, threadId, callback, board);
      }
    });

  } else if (!threadData) {

    return threads.findOne({
      boardUri : boardUri,
      threadId : threadId
    }, {
      projection : threadProjection
    }, function gotThread(error, thread) {
      if (error) {
        callback(error);
      } else if (!thread) {
        callback('No thread');
      } else {
        exports.thread(boardUri, threadId, callback, boardData, thread);
      }

    });

  }

  if (verbose) {
    console.log('Generating thread ' + threadId + ' of board ' + boardUri);
  }

  posts.find({
    boardUri : boardUri,
    threadId : threadId
  }, {
    projection : postProjection
  }).sort({
    creation : 1
  }).toArray(
      function(error, foundPosts) {
        if (error) {
          return callback(error);
        }

        // style exception, too simple
        jsonBuilder.thread(boardUri, boardData, threadData, foundPosts,
            function savedJson(error) {

              if (error) {
                return callback(error);
              }

              exports.generateThreadHTML(boardData, flagData, threadData,
                  foundPosts, foundPosts.slice(-latestLimit), callback);

            }, null, null, flagData);
        // style exception, too simple

      });

};
// } Section 1: Thread

// Section 2: Board page {
exports.saveBoardHTML = function(boardUri, page, threadsArray, pageCount,
    boardData, flagData, latestPosts, callback, language) {

  domManipulator.page(page, threadsArray, pageCount, boardData, flagData,
      latestPosts, language, false, null, function savedHTML(error) {
        if (error) {
          callback(error);
        } else {

          if (!altLanguages) {
            jsonBuilder.page(boardUri, page, threadsArray, pageCount,
                boardData, flagData, latestPosts, false, null, callback);
            return;
          }

          // style exception, too simple
          rootModule.nextLanguage(language, function gotLanguage(error,
              language) {

            if (error) {
              callback(error);
            } else if (!language) {
              jsonBuilder.page(boardUri, page, threadsArray, pageCount,
                  boardData, flagData, latestPosts, false, null, callback);
            } else {

              exports.saveBoardHTML(boardUri, page, threadsArray, pageCount,
                  boardData, flagData, latestPosts, callback, language);

            }

          });
          // style exception, too simple

        }
      });

};

exports.getLatestPosts = function(boardUri, page, threadsArray, pageCount,
    boardData, flagData, callback) {

  var postsToFetch = [];

  for (var i = 0; i < threadsArray.length; i++) {

    var thread = threadsArray[i];
    var threadLatest = thread.latestPosts;

    if (threadLatest) {

      if (thread.pinned && threadLatest.length > latestPinned) {
        threadLatest.splice(0, threadLatest.length - latestPinned);
      }

      postsToFetch = postsToFetch.concat(threadLatest);
    }
  }

  posts.aggregate([ {
    $match : {
      boardUri : boardUri,
      postId : {
        $in : postsToFetch
      }
    }
  }, {
    $project : postProjection
  }, {
    $group : {
      _id : '$threadId',
      latestPosts : {
        $push : {
          boardUri : '$boardUri',
          threadId : '$threadId',
          postId : '$postId',
          banMessage : '$banMessage',
          flag : '$flag',
          markdown : '$markdown',
          alternativeCaches : '$alternativeCaches',
          files : '$files',
          outerCache : '$outerCache',
          flagCode : '$flagCode',
          flagName : '$flagName',
          name : '$name',
          bypassId : '$bypassId',
          lastEditTime : '$lastEditTime',
          lastEditLogin : '$lastEditLogin',
          signedRole : '$signedRole',
          id : '$id',
          email : '$email',
          subject : '$subject',
          creation : '$creation'
        }
      }
    }
  } ]).toArray(
      function gotPosts(error, latestPosts) {
        if (error) {
          callback(error);
        } else {

          exports.saveBoardHTML(boardUri, page, threadsArray, pageCount,
              boardData, flagData, latestPosts, callback);
        }
      });

};

exports.page = function(boardUri, page, callback, boardData, flagData) {

  if (!flagData) {

    flags.find({
      boardUri : boardUri
    }, {
      projection : {
        name : 1
      }
    }).sort({
      name : 1
    }).toArray(function gotFlags(error, foundFlags) {
      if (error) {
        callback(error);
      } else {
        exports.page(boardUri, page, callback, boardData, foundFlags);
      }
    });

    return;
  } else if (!boardData) {

    boards.findOne({
      boardUri : boardUri
    }, {
      projection : exports.boardProjection
    }, function gotBoard(error, board) {
      if (error) {
        callback(error);
      } else if (!board) {
        callback('Board not found');
      } else {
        exports.page(boardUri, page, callback, board);
      }
    });

    return;
  }

  var pageCount = Math.ceil(boardData.threadCount / pageSize);

  pageCount = pageCount || 1;

  if (verbose) {

    var message = 'Generating page ' + page + '/' + pageCount;
    console.log(message + ' of board ' + boardUri);
  }

  // actual function start
  var toSkip = (page - 1) * pageSize;

  threads.find({
    boardUri : boardUri,
    archived : {
      $ne : true
    }
  }, {
    projection : threadProjection
  }).sort({
    pinned : -1,
    lastBump : -1
  }).skip(toSkip).limit(pageSize).toArray(
      function gotThreads(error, threadsArray) {

        var skipPage = threadsArray && page !== 1 && !threadsArray.length;

        if (error || skipPage) {
          callback(error, skipPage);
        } else {
          exports.getLatestPosts(boardUri, page, threadsArray, pageCount,
              boardData, flagData, callback);
        }
      });

};
// } Section 2: Board page

// Section 3: Catalog {
exports.buildCatalogJsonAndRss = function(boardData, threads, callback) {

  jsonBuilder.catalog(boardData.boardUri, threads,
      function generatedJson(error) {

        if (error) {
          callback(error);
        } else {
          rssBuilder.board(boardData, threads, callback);
        }

      });

};

exports.buildCatalogHTML = function(boardData, foundThreads, flagData,
    callback, language) {

  domManipulator.catalog(language, boardData, foundThreads, flagData,
      function savedHTML(error) {

        if (error) {
          callback(error);
        } else {

          if (!altLanguages) {
            exports.buildCatalogJsonAndRss(boardData, foundThreads, callback);
            return;
          }

          // style exception, too simple
          rootModule.nextLanguage(language,
              function gotLanguage(error, language) {

                if (error) {
                  callback(error);
                } else if (!language) {
                  exports.buildCatalogJsonAndRss(boardData, foundThreads,
                      callback);
                } else {
                  exports.buildCatalogHTML(boardData, foundThreads, flagData,
                      callback, language);
                }

              });
          // style exception, too simple

        }

      });

};

exports.catalog = function(boardUri, callback, boardData, flagData) {

  if (!boardData) {

    boards.findOne({
      boardUri : boardUri
    }, {
      projection : exports.boardProjection
    }, function gotBoardData(error, boardData) {
      if (error) {
        callback(error);
      } else if (!boardData) {
        callback('Board not found');
      } else {
        exports.catalog(boardUri, callback, boardData);
      }
    });

    return;
  } else if (!flagData && !disableCatalogPosting) {

    flags.find({
      boardUri : boardUri
    }, {
      projection : {
        name : 1
      }
    }).sort({
      name : 1
    }).toArray(function gotFlags(error, foundFlags) {
      if (error) {
        callback(error);
      } else {
        exports.catalog(boardUri, callback, boardData, foundFlags);
      }
    });

    return;
  }

  if (verbose) {
    console.log('Building catalog of ' + boardUri);
  }

  threads.find({
    boardUri : boardUri,
    archived : {
      $ne : true
    }
  }, {
    projection : threadProjection
  }).sort({
    pinned : -1,
    lastBump : -1
  }).limit(maxThreads).toArray(function gotThreads(error, foundThreads) {
    if (error) {
      callback(error);
    } else {
      exports.buildCatalogHTML(boardData, foundThreads, flagData, callback);
    }
  });

};
// } Section 3: Catalog

// Section 4: Rules {
exports.buildRulesHTML = function(boardUri, rules, callback, language) {

  domManipulator.rules(language, boardUri, rules,
      function generatedHTML(error) {
        if (error) {
          callback(error);
        } else {

          if (!altLanguages) {
            jsonBuilder.rules(boardUri, rules, callback);
            return;
          }

          // style exception, too simple
          rootModule.nextLanguage(language, function gotNextLanguage(error,
              language) {

            if (error) {
              callback(error);
            } else if (!language) {
              jsonBuilder.rules(boardUri, rules, callback);
            } else {
              exports.buildRulesHTML(boardUri, rules, callback, language);
            }
          });
          // style exception, too simple

        }
      });

};

exports.rules = function(boardUri, callback) {

  if (verbose) {
    console.log('Building rules for ' + boardUri);
  }

  boardOps.boardRules(boardUri, null, null, function gotRules(error, rules) {
    if (error) {
      callback(error);
    } else {
      exports.buildRulesHTML(boardUri, rules, callback);
    }
  });

};
// } Section 4: Rules

