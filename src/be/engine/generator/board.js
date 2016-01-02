'use strict';

// handles generation control of pages specific to a board

var db = require('../../db');
var boards = db.boards();
var flags = db.flags();
var threads = db.threads();
var posts = db.posts();
var settingsHandler = require('../../settingsHandler');
var settings = settingsHandler.getGeneralSettings();
var pageSize = settings.pageSize;
var verbose = settings.verbose;
var domManipulator;
var postProjection;
var threadProjection;
var mbHandler;
var boardOps;
var rssBuilder;
var jsonBuilder;

var boardProjection = {
  _id : 0,
  boardUri : 1,
  threadCount : 1,
  boardName : 1,
  boardMarkdown : 1,
  usesCustomJs : 1,
  usesCustomCss : 1,
  settings : 1,
  boardDescription : 1
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
          domManipulator.thread(boardUri, boardData, flagData, threadData,
              posts, function savedHtml(error) {
                if (error) {
                  callback(error);
                } else {
                  mbHandler.clearCache(boardUri);

                  jsonBuilder.thread(boardUri, boardData, threadData, posts,
                      callback, null, null, flagData);
                }
              });
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
exports.buildRssAndJsonPages = function(boardUri, page, threadsArray,
    pageCount, boardData, flagData, latestPosts, callback) {

  jsonBuilder.page(boardUri, page, threadsArray, pageCount, boardData,
      flagData, latestPosts, function builtJson(error) {

        if (error || page > 1) {
          callback(error);
        } else {
          rssBuilder.board(boardData, threadsArray, callback);
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
          postId : '$postId',
          banMessage : '$banMessage',
          flag : '$flag',
          markdown : '$markdown',
          files : '$files',
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
              exports.buildRssAndJsonPages(boardUri, page, threadsArray,
                  pageCount, boardData, flagData, latestPosts, callback);
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

  threads.update({
    boardUri : boardUri,
    threadId : {
      $in : ids
    }
  }, {
    $set : {
      page : page
    }
  }, {
    multi : true
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

exports.catalog = function(boardUri, callback, boardData) {

  if (!boardData) {

    boards.findOne({
      boardUri : boardUri
    }, boardProjection, function gotBoardData(error, boardData) {
      exports.catalog(boardUri, callback, boardData);
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
  }).toArray(function gotThreads(error, threads) {
    if (error) {
      callback(error);
    } else {

      // style exception, too simple
      domManipulator.catalog(boardData, threads, function savedHTML(error) {
        jsonBuilder.catalog(boardUri, threads, callback);
      });

      // style exception, too simple
    }
  });

};

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
    console.log('Generating board ' + boardUri);
  }

  var pageCount = Math.floor(boardData.threadCount / pageSize);
  pageCount += (boardData.threadCount % pageSize ? 1 : 0);

  pageCount = pageCount || 1;

  exports.pageIteration(boardUri, pageCount, boardData, cb, reloadThreads);

};
// } Section 1.1: Board

exports.iterateBoards = function(cursor, callback) {

  cursor.next(function gotResults(error, board) {
    if (error) {

      callback(error);
    } else if (!board) {

      callback();
    } else {

      // style exception parent callback is too simple
      exports.board(board.boardUri, true, true, function generatedBoard(error) {

        if (error) {
          callback(error);
        } else {
          exports.iterateBoards(cursor, callback);
        }

      }, board);
      // style exception parent callback is too simple

    }

  });

};

exports.boards = function(callback) {

  if (verbose) {
    console.log('Generating all boards.');
  }

  var cursor = boards.find({}, boardProjection);

  exports.iterateBoards(cursor, callback);

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
      message += (postingData.threadId || postingData.postId);

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

exports.iteratePostsForPreviews = function(callback, postsCursor) {

  postsCursor = postsCursor || posts.find({}, postProjection);

  postsCursor.next(function gotThread(error, post) {

    if (error) {
      callback(error);
    } else if (post) {

      exports.preview(null, null, null, function generatedPreview(error) {

        if (error) {
          callback(error);
        } else {
          exports.iteratePostsForPreviews(callback, postsCursor);
        }

      }, post);

    } else {
      callback();
    }

  });

};

exports.previews = function(callback, threadsCursor) {

  threadsCursor = threadsCursor || threads.find({}, postProjection);

  threadsCursor.next(function gotThread(error, thread) {

    if (error) {
      callback(error);
    } else if (thread) {

      exports.preview(null, null, null, function generatedPreview(error) {

        if (error) {
          callback(error);
        } else {
          exports.previews(callback, threadsCursor);
        }

      }, thread);

    } else {
      exports.iteratePostsForPreviews(callback);
    }

  });

};
// } Section 2: Previews

