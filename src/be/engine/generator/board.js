'use strict';

// handles generation control of pages specific to a board

var exec = require('child_process').exec;
var kernel = require('../../kernel');
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
var mbHandler;
var boardOps;
var rssBuilder;
var jsonBuilder;
var maxThreads;
var disableCatalogPosting;

var boardProjection = {
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
  locationFlagMode : 1
};

exports.loadSettings = function() {

  var settings = settingsHandler.getGeneralSettings();
  pageSize = settings.pageSize;
  altLanguages = settings.useAlternativeLanguages;
  verbose = settings.verbose || settings.verboseGenerator;
  disableCatalogPosting = settings.disableCatalogPosting;
  maxThreads = settings.maxThreadCount;

};

exports.loadDependencies = function() {

  rootModule = require('.');
  mbHandler = require('../multiBoardHandler');
  postProjection = rootModule.postProjection;
  threadProjection = rootModule.threadProjection;
  boardOps = require('../boardOps').rules;
  domManipulator = require('../domManipulator').staticPages;
  jsonBuilder = require('../jsonBuilder');
  rssBuilder = require('../rssBuilder');

};

// Section 1: Boards {

// Section 1.1: Board {

// Section 1.1.1: Thread {
exports.generateThreadHTML = function(boardUri, boardData, flagData,
    threadData, foundPosts, callback, language) {

  domManipulator.thread(boardUri, boardData, flagData, threadData, foundPosts,
      function generatedHTML(error) {

        if (error) {
          callback(error);
        } else {

          if (!altLanguages) {
            callback();
            return;
          }

          rootModule.nextLanguage(language, function gotNextLanguage(error,
              language) {

            if (error) {
              callback(language);
            } else if (!language) {
              callback();
            } else {
              exports.generateThreadHTML(boardUri, boardData, flagData,
                  threadData, foundPosts, callback, language);
            }

          });

        }

      }, null, null, language);

};

exports.thread = function(boardUri, threadId, callback, boardData, threadData,
    flagData) {

  if (!flagData) {

    flags.find({
      boardUri : boardUri
    }, {
      name : 1
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

    return;
  } else if (!boardData) {

    boards.findOne({
      boardUri : boardUri
    }, boardProjection, function gotBoard(error, board) {
      if (error) {
        callback(error);
      } else if (!board) {
        callback('Board not found');
      } else {
        exports.thread(boardUri, threadId, callback, board);
      }
    });

    return;
  } else if (!threadData) {

    threads.findOne({
      boardUri : boardUri,
      threadId : threadId
    }, threadProjection, function gotThread(error, thread) {
      if (error) {
        callback(error);
      } else if (!thread) {
        callback('No thread');
      } else {
        exports.thread(boardUri, threadId, callback, boardData, thread);
      }

    });

    return;
  }

  if (verbose) {
    console.log('Generating thread ' + threadId + ' of board ' + boardUri);
  }

  posts.find({
    boardUri : boardUri,
    threadId : threadId
  }, postProjection).sort({
    creation : 1
  }).toArray(
      function(error, foundPosts) {
        if (error) {
          callback(error);
        } else {

          // style exception, too simple
          jsonBuilder.thread(boardUri, boardData, threadData, foundPosts,
              function savedJson(error) {

                if (error) {
                  callback(error);
                } else {

                  mbHandler.clearCache(boardUri);

                  exports.generateThreadHTML(boardUri, boardData, flagData,
                      threadData, foundPosts, callback);

                }

              }, null, null, flagData);
          // style exception, too simple

        }
      });

};

exports.iterateThreadsCursor = function(boardUri, boardData, cursor, callback) {

  cursor.next(function(error, thread) {
    if (error) {
      callback(error);
    } else if (!thread) {
      callback();
    } else {

      // style exception, too simple
      exports.thread(boardUri, thread.threadId, function generatedPage(error) {
        if (error) {
          callback(error);
        } else {
          exports.iterateThreadsCursor(boardUri, boardData, cursor, callback);
        }

      }, boardData, thread);
      // style exception, too simple

    }
  });

};

exports.getThreads = function(boardUri, boardData, callback) {

  var cursor = threads.find({
    boardUri : boardUri,
  }, threadProjection);

  exports.iterateThreadsCursor(boardUri, boardData, cursor, callback);

};

exports.allThreads = function(boardUri, callback, boardData) {

  if (!boardData) {

    boards.findOne({
      boardUri : boardUri
    }, boardProjection, function gotBoard(error, board) {
      if (error) {
        callback(error);
      } else if (!board) {
        callback('Board not found');
      } else {
        exports.allThreads(boardUri, callback, board);
      }
    });

    return;
  }

  exports.getThreads(boardUri, boardData, callback);

};
// } Section 1.1.1: Thread

// Section 1.1.2: Board page {
exports.saveBoardHTML = function(boardUri, page, threadsArray, pageCount,
    boardData, flagData, latestPosts, callback, language) {

  domManipulator.page(boardUri, page, threadsArray, pageCount, boardData,
      flagData, latestPosts, language, function savedHTML(error) {
        if (error) {
          callback(error);
        } else {

          if (!altLanguages) {
            jsonBuilder.page(boardUri, page, threadsArray, pageCount,
                boardData, flagData, latestPosts, callback);
            return;
          }

          // style exception, too simple
          rootModule.nextLanguage(language, function gotLanguage(error,
              language) {

            if (error) {
              callback(error);
            } else if (!language) {
              jsonBuilder.page(boardUri, page, threadsArray, pageCount,
                  boardData, flagData, latestPosts, callback);
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
    if (threadsArray[i].latestPosts) {
      postsToFetch = postsToFetch.concat(threadsArray[i].latestPosts);
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
  } ], function gotPosts(error, latestPosts) {
    if (error) {
      callback(error);
    } else {
      exports.saveBoardHTML(boardUri, page, threadsArray, pageCount, boardData,
          flagData, latestPosts, callback);
    }
  });

};

// pre-aggregates the page the thread is sitting in.
exports.updateThreadsPage = function(boardUri, page, threadsArray, pageCount,
    boardData, flagData, callback) {

  var ids = [];

  for (var i = 0; i < threadsArray.length; i++) {
    ids.push(threadsArray[i].threadId);
  }

  threads.updateMany({
    boardUri : boardUri,
    threadId : {
      $in : ids
    }
  }, {
    $set : {
      page : page
    }
  }, function(error, result) {
    if (error) {
      callback(error);
    } else {

      exports.getLatestPosts(boardUri, page, threadsArray, pageCount,
          boardData, flagData, callback);

    }

  });

};

exports.page = function(boardUri, page, callback, boardData, flagData) {

  if (!flagData) {

    flags.find({
      boardUri : boardUri
    }, {
      name : 1
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
    }, boardProjection, function gotBoard(error, board) {
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
    boardUri : boardUri
  }, threadProjection).sort({
    pinned : -1,
    lastBump : -1
  }).skip(toSkip).limit(pageSize).toArray(
      function gotThreads(error, threadsArray) {
        if (error) {
          callback(error);
        } else {

          exports.updateThreadsPage(boardUri, page, threadsArray, pageCount,
              boardData, flagData, callback);
        }
      });

};
// } Section 1.1.2: Board page

// Section 1.1.3: Catalog {
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
    }, boardProjection, function gotBoardData(error, boardData) {
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
      name : 1
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
    boardUri : boardUri
  }, threadProjection).sort({
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
// } Section 1.1.3: Catalog

exports.pageIteration = function(boardUri, currentPage, boardData, callback,
    rebuildThreadPages) {

  if (currentPage < 1) {

    exports.catalog(boardUri, function generatedCatalog(error) {
      if (error) {
        callback(error);
      } else {
        if (rebuildThreadPages) {
          exports.allThreads(boardUri, callback, boardData);
        } else {
          callback();
        }
      }
    });

    return;
  }

  exports.page(boardUri, currentPage, function createdPage(error) {
    if (error) {
      callback(error);
    } else {
      exports.pageIteration(boardUri, --currentPage, boardData, callback,
          rebuildThreadPages);
    }
  }, boardData);

};

exports.board = function(boardUri, reloadThreads, reloadRules, cb, boardData) {

  // we allow for the basic board data to be informed, but fetch if not sent.
  if (!boardData) {

    boards.findOne({
      boardUri : boardUri
    }, boardProjection, function gotBoard(error, board) {
      if (error) {
        cb(error);
      } else if (!board) {
        cb('Board not found');
      } else {
        exports.board(boardUri, reloadThreads, reloadRules, cb, board);
      }
    });

    return;
  }

  if (reloadRules) {
    exports.rules(boardUri, function reloadedRules(error) {
      if (error) {
        cb(error);
      } else {
        exports.board(boardUri, reloadThreads, false, cb, boardData);
      }
    });

    return;
  }

  if (verbose) {
    console.log('\nGenerating board ' + boardUri);
  }

  if (boardData.threadCount > maxThreads) {
    boardData.threadCount = maxThreads;
  }

  var pageCount = Math.ceil(boardData.threadCount / pageSize);

  pageCount = pageCount || 1;

  exports.pageIteration(boardUri, pageCount, boardData, cb, reloadThreads);

};
// } Section 1.1: Board

// Section 1.2: Rules {
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
// } Section 1.2: Rules

exports.iterateBoards = function(callback, lastUri, toSkip, startedSkipping) {

  var query = {};

  if (lastUri) {
    query.boardUri = {
      $lt : lastUri
    };
  }

  var cursor = boards.find(query, boardProjection).sort({
    boardUri : -1
  });

  if (toSkip && startedSkipping) {
    cursor.skip(toSkip);
  }

  cursor.limit(1).toArray(function gotResults(error, results) {

    if (error) {
      callback(error);
    } else if (!results || !results.length) {
      callback();
    } else {

      var board = results[0];

      // style exception parent callback is too simple
      exports.board(board.boardUri, true, true, function generatedBoard(error) {

        if (error) {
          callback(error);
        } else {
          exports.iterateBoards(callback, board.boardUri, toSkip, true);
        }

      }, board);
      // style exception parent callback is too simple

    }

  });

};

exports.startBoardRebuildProcesses = function(callback, initialBoards) {

  var remaining = initialBoards.length;

  var bootPath = __dirname + '/../../boot.js -nd -rboard -nf';

  if (remaining > 1) {
    bootPath += ' -i ' + (remaining - 1);
  } else if (!remaining) {
    callback();

    return;
  }

  var running = true;

  var execCallback = function(error, stdout, stderr) {

    if (!running) {
      return;
    }

    var trimmed = stdout.trim();

    if (trimmed.length) {
      console.log(trimmed);
    }

    if (error) {
      running = false;
      callback(stderr);

    } else {

      remaining--;

      if (!remaining) {
        running = false;
        callback();
      }

    }

  };

  for (var i = 0; i < remaining; i++) {

    var pathToUse = bootPath;

    if (i) {
      pathToUse += ' -b ' + (initialBoards[i - 1]).boardUri;
    }

    exec(pathToUse, execCallback);

  }

};

exports.boards = function(callback) {

  var informedArguments = kernel.informedArguments();

  if (informedArguments.noFork.informed) {

    exports.iterateBoards(callback, informedArguments.board.value,
        +informedArguments.interval.value);

    return;
  }

  boards.find({}, {
    boardUri : 1,
    _id : 0
  }).sort({
    boardUri : -1
  }).limit(require('os').cpus().length).toArray(
      function gotInitialBoards(error, initialBoards) {

        if (error) {
          callback(error);
        } else {
          exports.startBoardRebuildProcesses(callback, initialBoards);
        }

      });

};
// } Section 1: Boards

