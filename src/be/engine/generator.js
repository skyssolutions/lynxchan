'use strict';

// handles logic of static pages generation.
// will not actually handle the dom, that happens at domManipulator

var mongo = require('mongodb');
var ObjectID = mongo.ObjectID;
var db = require('../db');
var overboard = db.overboardThreads();
var posts = db.posts();
var threads = db.threads();
var boards = db.boards();
var flags = db.flags();
var latestPostsCol = db.latestPosts();
var stats = db.stats();
var boot = require('../boot');
var settingsHandler = require('../settingsHandler');
var settings = settingsHandler.getGeneralSettings();
var topBoardsCount = settings.topBoardsCount;
var templateSettings = settingsHandler.getTemplateSettings();
var pageSize = settings.pageSize;
var verbose = settings.verbose;
var globalLatestPosts = settings.globalLatestPosts;
var domManipulator;
var boardOps;
var miscOps;
var gfsHandler;
var jsonBuilder;

var postProjection = {
  _id : 0,
  subject : 1,
  creation : 1,
  threadId : 1,
  boardUri : 1,
  postId : 1,
  name : 1,
  flag : 1,
  flagName : 1,
  files : 1,
  banMessage : 1,
  message : 1,
  email : 1,
  lastEditTime : 1,
  lastEditLogin : 1,
  id : 1,
  signedRole : 1,
  markdown : 1
};

var threadProjection = {
  _id : 0,
  id : 1,
  subject : 1,
  signedRole : 1,
  banMessage : 1,
  flagName : 1,
  cyclic : 1,
  lastEditTime : 1,
  boardUri : 1,
  lastEditLogin : 1,
  threadId : 1,
  creation : 1,
  flag : 1,
  name : 1,
  page : 1,
  files : 1,
  locked : 1,
  pinned : 1,
  email : 1,
  markdown : 1,
  lastBump : 1,
  latestPosts : 1,
  postCount : 1,
  message : 1,
  fileCount : 1
};

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

var toGenerate;
var MAX_TO_GENERATE = 9;
var reloading;

exports.loadDependencies = function() {

  domManipulator = require('./domManipulator').staticPages;
  boardOps = require('./boardOps').rules;
  miscOps = require('./miscOps');
  gfsHandler = require('./gridFsHandler');
  jsonBuilder = require('./jsonBuilder');

};

var fullReloadCallback = function(error, callback) {

  if (!reloading) {
    return;
  }

  if (error) {
    reloading = false;
    callback(error);
  }

  toGenerate--;

  if (!toGenerate) {

    if (verbose) {
      console.log('Finished generating all pages');
    }

    callback();
  }

};

exports.all = function(callback) {

  if (reloading) {
    return;
  }

  reloading = true;
  toGenerate = MAX_TO_GENERATE;

  exports.frontPage(function reloaded(error) {
    fullReloadCallback(error, callback);
  });

  exports.spoiler(function reloaded(error) {
    fullReloadCallback(error, callback);
  });

  exports.defaultBanner(function reloaded(error) {
    fullReloadCallback(error, callback);
  });

  exports.notFound(function reloaded(error) {
    fullReloadCallback(error, callback);
  });

  exports.boards(function reloaded(error) {
    fullReloadCallback(error, callback);
  });

  exports.thumb(function reloaded(error) {
    fullReloadCallback(error, callback);
  });

  exports.login(function reloaded(error) {
    fullReloadCallback(error, callback);
  });

  exports.maintenance(function reloaded(error) {
    fullReloadCallback(error, callback);
  });

  exports.audioThumb(function reloaded(error) {
    fullReloadCallback(error, callback);
  });

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

exports.defaultPages = function(callback) {

  exports.frontPage(function generatedFrontPage(error) {

    if (error) {
      callback(error);
    } else {
      exports.notFound(callback);
    }

  });

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

exports.preview = function(boardUri, threadId, postId, callback, postingData) {

  if (!postingData) {

    var queryBlock = {
      boardUri : boardUri,
      threadId : threadId
    };

    var collection = threads;

    if (postId) {
      collection = posts;
      queryBlock.postId = postId;
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

// Section 2: Boards {

// Section 2.1: Board {

// Section 2.1.1: Thread {
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
                  jsonBuilder.thread(boardUri, boardData, threadData, posts,
                      callback);
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
// } Section 2.1.1: Thread

// Section 2.1.2: Board page {
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
// } Section 2.1.2: Board page

exports.catalog = function(boardUri, callback) {

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
      domManipulator.catalog(boardUri, threads, function savedHTML(error) {
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
// } Section 2.1: Board

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
// } Section 2: Boards

// Section 3: Overboard {
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
        } else {
          exports.getOverboardPosts(foundThreads, callback);
        }
      });

};

exports.overboard = function(callback) {

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

  callback();

};
// } Section 3: Overboard
