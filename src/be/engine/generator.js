'use strict';

// handles logic of page generation.
// will not actually handle the dom, that happens at domManipulator

var db = require('../db');
var posts = db.posts();
var threads = db.threads();
var boards = db.boards();
var domManipulator = require('./domManipulator');
var settings = require('../boot').getGeneralSettings();
var pageSize = settings.pageSize;
var verbose = settings.verbose;

var toGenerate;
var MAX_TO_GENERATE = 3;
var reloading;

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

  // TODO call other generations
  exports.frontPage(function reloaded(error) {
    fullReloadCallback(error, callback);
  });

  exports.notFound(function reloaded(error) {
    fullReloadCallback(error, callback);
  });

  exports.boards(function reloaded(error) {
    fullReloadCallback(error, callback);
  });

};

exports.notFound = function(callback) {

  if (verbose) {
    console.log('Generating 404 page');
  }

  domManipulator.notFound(callback);

};

exports.frontPage = function(callback) {

  if (verbose) {
    console.log('Generating front-page');
  }

  boards.find({}, {
    _id : 0,
    boardUri : 1,
    boardName : 1
  }).sort({
    boardUri : 1
  }).toArray(function gotResults(error, results) {
    if (error) {
      callback(error);
    } else {
      domManipulator.frontPage(results, callback);
    }
  });

};

exports.defaultPages = function(callback) {

  exports.frontPage(function generatedFrontPage(error) {

    if (error) {
      callback(error);
    } else {
      exports.notFound(callback);
    }

  });

};

// board creation start
// thread pages start

exports.thread = function(boardUri, threadId, callback, boardData, threadData) {

  if (!boardData) {
    if (verbose) {
      console.log('Obtaining board data.');
    }

    boards.findOne({
      boardUri : boardUri
    }, {
      _id : 0,
      boardName : 1,
      boardDescription : 1
    }, function gotBoard(error, board) {
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
    }, {
      _id : 0,
      subject : 1,
      threadId : 1,
      name : 1,
      email : 1,
      message : 1
    }, function gotThread(error, thread) {
      if (error) {
        callback(error);
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
    parent : threadId
  }, {
    _id : 0,
    subject : 1,
    postId : 1,
    name : 1,
    email : 1,
    message : 1
  }).sort({
    creation : 1
  }).toArray(function(error, posts) {
    if (error) {
      callback(error);
    } else {
      domManipulator.thread(boardUri, boardData, threadData, posts, callback);
    }
  });

};

function iterateThreadsCursor(boardUri, boardData, cursor, callback) {

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
          iterateThreadsCursor(boardUri, boardData, cursor, callback);
        }

      }, boardData, thread);
      // style exception, too simple

    }
  });

}

function getThreads(boardUri, boardData, callback) {

  var cursor = threads.find({
    boardUri : boardUri,
  }, {
    _id : 0,
    subject : 1,
    threadId : 1,
    name : 1,
    email : 1,
    message : 1
  });

  iterateThreadsCursor(boardUri, boardData, cursor, callback);

}

exports.allThreads = function(boardUri, callback, boardData) {

  if (!boardData) {

    if (verbose) {
      console.log('Obtaining board data.');
    }

    boards.findOne({
      boardUri : boardUri
    }, {
      _id : 0,
      boardName : 1,
      boardDescription : 1
    }, function gotBoard(error, board) {
      if (error) {
        callback(error);
      } else {
        exports.allThreads(boardUri, callback, board);
      }
    });

    return;
  }

  getThreads(boardUri, boardData, callback);

};

// thread pages end

// page creation start

// pre-aggregates the page the thread is sitting in.
function updateThreadsPage(boardUri, page, threadsArray, pageCount, boardData,
    callback) {

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
      domManipulator.page(boardUri, page, threadsArray, pageCount, boardData,
          callback);
    }

  });

}

exports.page = function(boardUri, page, callback, boardData) {

  // we allow for the basic board data to be informed, but fetch if not sent.
  if (!boardData) {

    if (verbose) {
      console.log('Obtaining board data.');
    }

    boards.findOne({
      boardUri : boardUri
    }, {
      _id : 0,
      boardName : 1,
      boardDescription : 1,
      threadCount : 1
    }, function gotBoard(error, board) {
      if (error) {
        callback(error);
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
  }, {
    threadId : 1,
    content : 1,
    _id : 0,
    lastBump : 1,
  }).sort({
    lastBump : -1
  }).skip(toSkip).limit(pageSize).toArray(
      function(error, threadsArray) {
        if (error) {
          callback(error);
        } else {

          updateThreadsPage(boardUri, page, threadsArray, pageCount, boardData,
              callback);
        }
      });

};

// page creation end

function pageIteration(boardUri, currentPage, boardData, callback,
    rebuildThreadPages) {

  if (currentPage < 1) {
    if (rebuildThreadPages) {
      exports.allThreads(boardUri, callback, boardData);
    } else {
      callback();
    }
    return;
  }

  exports.page(boardUri, currentPage, function createdPage(error) {
    if (error) {
      callback(error);
    } else {
      pageIteration(boardUri, --currentPage, boardData, callback,
          rebuildThreadPages);
    }
  }, boardData);

}

// TODO generate only first X pages

exports.board = function(boardUri, reloadThreads, callback, boardData) {

  // we allow for the basic board data to be informed, but fetch if not sent.
  if (!boardData) {

    if (verbose) {
      console.log('Obtaining board data.');
    }

    boards.findOne({
      boardUri : boardUri
    }, {
      _id : 0,
      boardName : 1,
      boardDescription : 1,
      threadCount : 1
    }, function gotBoard(error, board) {
      if (error) {
        callback(error);
      } else {
        exports.board(boardUri, reloadThreads, callback, board);
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

  threads.find({
    boardUri : boardUri
  }).count(false, null, function gotCount(error, count) {
    if (error) {
      callback(error);
    } else {

      pageIteration(boardUri, pageCount, boardData, callback, reloadThreads);
    }
  });

};

// board creation end

function iterateBoards(cursor, callback) {

  cursor.next(function gotResults(error, board) {
    if (error) {
      callback(error);
    } else if (!board) {

      callback();
    } else {

      // style exception parent callback is too simple
      exports.board(board.boardUri, true, function generatedBoard(error) {

        iterateBoards(cursor, callback);

      }, board);
      // style exception parent callback is too simple

    }

  });

}

exports.boards = function(callback) {

  if (verbose) {
    console.log('Generating all boards.');
  }

  var cursor = boards.find({}, {
    _id : 0,
    boardUri : 1,
    boardName : 1,
    boardDescription : 1,
    threadCount : 1
  });

  iterateBoards(cursor, callback);

};