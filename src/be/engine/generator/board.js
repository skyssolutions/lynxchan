'use strict';

// handles generation control of pages specific to a board

var exec = require('child_process').exec;
var ObjectID = require('mongodb').ObjectID;
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
var postProjection;
var threadProjection;
var mbHandler;
var boardOps;
var rssBuilder;
var jsonBuilder;
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
  boardDescription : 1
};

exports.loadSettings = function() {

  var settings = settingsHandler.getGeneralSettings();
  pageSize = settings.pageSize;
  verbose = settings.verbose;
  disableCatalogPosting = settings.disableCatalogPosting;

};

exports.loadDependencies = function() {

  var rootModule = require('.');
  mbHandler = require('../multiBoardHandler');
  postProjection = rootModule.postProjection;
  threadProjection = rootModule.threadProjection;
  boardOps = require('../boardOps').rules;
  domManipulator = require('../domManipulator').staticPages;
  jsonBuilder = require('../jsonBuilder');
  rssBuilder = require('../rssBuilder');

};

exports.rules = function(boardUri, callback) {

  boardOps.boardRules(boardUri, null, function gotRules(error, rules) {
    if (error) {
      callback(error);
    } else {

      domManipulator.rules(boardUri, rules, function generatedHTML(error) {
        if (error) {
          callback(error);
        } else {
          jsonBuilder.rules(boardUri, rules, callback);
        }
      });

    }
  });

};

// Section 1: Boards {

// Section 1.1: Board {

// Section 1.1.1: Thread {
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
    if (verbose) {
      console.log('Obtaining board data.');
    }

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
    if (verbose) {
      console.log('Obtaining thread data.');
    }

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
      function(error, posts) {
        if (error) {
          callback(error);
        } else {

          // style exception, too simple
          jsonBuilder.thread(boardUri, boardData, threadData, posts,
              function savedJson(error) {

                if (error) {
                  callback(error);
                } else {
                  mbHandler.clearCache(boardUri);

                  domManipulator.thread(boardUri, boardData, flagData,
                      threadData, posts, callback);
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

    if (verbose) {
      console.log('Obtaining board data.');
    }

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
          postId : '$postId',
          banMessage : '$banMessage',
          flag : '$flag',
          markdown : '$markdown',
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

      // style exception, too simple
      domManipulator.page(boardUri, page, threadsArray, pageCount, boardData,
          flagData, latestPosts, function savedHTML(error) {
            if (error) {
              callback(error);
            } else {
              jsonBuilder.page(boardUri, page, threadsArray, pageCount,
                  boardData, flagData, latestPosts, callback);
            }
          });
      // style exception, too simple

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

    if (verbose) {
      console.log('Obtaining board data.');
    }

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

  var pageCount = Math.floor(boardData.threadCount / pageSize);
  pageCount += (boardData.threadCount % pageSize ? 1 : 0);

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

// Section 1.1..3: Catalog {
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
  }).toArray(
      function gotThreads(error, threads) {
        if (error) {
          callback(error);
        } else {

          // style exception, too simple
          domManipulator.catalog(boardData, threads, flagData,
              function savedHTML(error) {
                exports.buildCatalogJsonAndRss(boardData, threads, callback);
              });
          // style exception, too simple

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

    if (verbose) {
      console.log('Obtaining board data.');
    }

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

  var pageCount = Math.floor(boardData.threadCount / pageSize);
  pageCount += (boardData.threadCount % pageSize ? 1 : 0);

  pageCount = pageCount || 1;

  exports.pageIteration(boardUri, pageCount, boardData, cb, reloadThreads);

};
// } Section 1.1: Board

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

// Section 2: Previews {
exports.preview = function(boardUri, threadId, postId, callback, postingData) {

  if (!postingData) {

    var queryBlock = {
      boardUri : boardUri
    };

    var collection;

    if (postId) {
      collection = posts;
      queryBlock.postId = postId;
    } else {
      collection = threads;
      queryBlock.threadId = threadId;
    }

    collection.findOne(queryBlock, postProjection, function gotPosting(error,
        posting) {
      if (error) {
        callback(error);
      } else if (!posting) {
        callback('Posting could not be found');
      } else {
        exports.preview(boardUri, threadId, postId, callback, posting);
      }
    });

  } else {

    if (verbose) {

      var message = 'Generating preview for ' + postingData.boardUri + '/';
      message += (postingData.postId || postingData.threadId);

      console.log(message);
    }

    domManipulator.preview(postingData, function savedHtml(error) {
      if (error) {
        callback(error);
      } else {
        jsonBuilder.preview(postingData, callback);
      }

    });

  }
};

exports.iteratePostsForPreviews = function(callback, lastId, toSkip,
    startedSkipping) {

  var query = {};

  if (lastId) {
    query._id = {
      $lt : lastId
    };
  }

  var cursor = posts.find(query, postProjection).sort({
    _id : -1
  });

  if (toSkip && startedSkipping) {
    cursor.skip(toSkip);
  }

  cursor.limit(1).toArray(function gotThread(error, results) {

    if (error) {
      callback(error);
    } else if (results && results.length) {

      var post = results[0];

      // style exception, too simple
      exports.preview(null, null, null, function generatedPreview(error) {

        if (error) {
          callback(error);
        } else {
          exports.iteratePostsForPreviews(callback, post._id, toSkip, true);
        }

      }, post);
      // style exception, too simple

    } else {
      callback();
    }

  });

};

exports.iterateThreadsForPreviews = function(callback, lastId, lastPostId,
    toSkip, startedSkipping) {

  var query = {};

  if (lastId) {
    query._id = {
      $lt : lastId
    };
  }

  var cursor = threads.find(query, postProjection).sort({
    _id : -1
  });

  if (toSkip && startedSkipping) {
    cursor.skip(toSkip);
  }

  cursor.limit(1);

  cursor.toArray(function gotThread(error, results) {

    if (error) {
      callback(error);
    } else if (results && results.length) {

      var thread = results[0];

      // style exception, too simple
      exports.preview(null, null, null, function generatedPreview(error) {

        if (error) {
          callback(error);
        } else {
          exports.iterateThreadsForPreviews(callback, thread._id, lastPostId,
              toSkip, true);
        }

      }, thread);
      // style exception, too simple

    } else {
      exports.iteratePostsForPreviews(callback, lastPostId, toSkip);
    }

  });

};

exports.getFinalCommand = function(bootPath, startThreads, startPosts, i) {

  var pathToUse = bootPath;

  if (i) {
    if (i < startThreads.length) {
      pathToUse += ' -t ' + (startThreads[i - 1])._id;
    }

    if (i < startPosts.length) {
      pathToUse += ' -po ' + (startPosts[i - 1])._id;
    }

  }

  return pathToUse;

};

exports.startPreviewRebuildProcesses = function(startThreads, startPosts,
    callback) {

  var count = startThreads.length > startPosts.length ? startThreads.length
      : startPosts.length;

  var bootPath = __dirname + '/../../boot.js -nd -rp -nf';

  if (count > 1) {
    bootPath += ' -i ' + (count - 1);
  } else if (!count) {

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

      count--;

      if (!count) {
        running = false;
        callback();
      }

    }

  };

  for (var i = 0; i < count; i++) {

    exec(exports.getFinalCommand(bootPath, startThreads, startPosts, i),
        execCallback);

  }

};

exports.previews = function(callback, lastId) {

  var informedArguments = kernel.informedArguments();

  if (informedArguments.noFork.informed) {

    exports.iterateThreadsForPreviews(callback, new ObjectID(
        informedArguments.thread.value), new ObjectID(
        informedArguments.post.value), +informedArguments.interval.value);

    return;
  }

  threads.find({}, {
    threadId : 1
  }).sort({
    _id : -1
  }).limit(require('os').cpus().length).toArray(
      function gotInitialThreads(error, initialThreads) {

        if (error) {
          callback(error);
        } else {

          // style exception, too simple
          posts.find({}, {
            postId : 1
          }).sort({
            _id : -1
          }).limit(require('os').cpus().length).toArray(
              function gotInitialPosts(error, initialPosts) {

                if (error) {
                  callback(error);
                } else {
                  exports.startPreviewRebuildProcesses(initialThreads,
                      initialPosts, callback);
                }

              });
          // style exception, too simple

        }

      });

};
// } Section 2: Previews

