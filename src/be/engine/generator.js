'use strict';

// handles logic of page generation.
// will not actually handle the dom, that happens at domManipulator

var frontPageTemplate;
var threadTemplate;
var boardTemplate;
var notFoundTemplate;

var db = require('../db');
var posts = db.posts();
var boards = db.boards();
var fs = require('fs');
var domManipulator = require('./domManipulator');
var boot = require('../boot');
var settings = boot.getGeneralSettings();
var pageSize = settings.pageSize;
var verbose = settings.verbose;
var jsdom = require('jsdom').jsdom;

exports.loadTemplates = function() {

  var fePath = boot.getFePath() + '/templates/';
  var templateSettings = boot.getTemplateSettings();

  frontPageTemplate = fs.readFileSync(fePath + templateSettings.index);
  threadTemplate = fs.readFileSync(fePath + templateSettings.threadPage);
  boardTemplate = fs.readFileSync(fePath + templateSettings.boardPage);
  notFoundTemplate = fs.readFileSync(fePath + templateSettings.notFoundPage);

};

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

  domManipulator.notFound(jsdom(notFoundTemplate), callback);

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
      domManipulator.frontPage(jsdom(frontPageTemplate), results, callback);
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

exports.thread = function(boardUri, threadId, callback, boardData) {

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
  }

  if (verbose) {
    console.log('Generating thread ' + threadId + ' of board ' + boardUri);
  }

  posts.find({
    boardUri : boardUri,
    $or : [ {
      postId : threadId
    }, {
      parent : threadId
    } ]
  }, {
    _id : 0,
    subject : 1,
    postId : 1,
    name : 1,
    email : 1,
    message : 1
  }).sort({
    creation : 1
  }).toArray(
      function(error, threads) {
        if (error) {
          callback(error);
        } else {
          domManipulator.thread(jsdom(threadTemplate), boardUri, boardData,
              threads, callback);
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
      exports.thread(boardUri, thread.postId, function generatedPage(error) {
        if (error) {
          callback(error);
        } else {
          iterateThreadsCursor(boardUri, boardData, cursor, callback);
        }

      }, boardData);
      // style exception, too simple

    }
  });

}

function getThreads(boardUri, boardData, callback) {

  var cursor = posts.find({
    boardUri : boardUri,
    parent : {
      $exists : 0
    }
  }, {
    _id : 0,
    postId : 1
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
function generateThreadListing(document, boardUri, page, threads, callback) {

}

exports.page = function(boardUri, page, callback, pageCount, boardData) {

  // we allow for the page count to be informed, but fetch if not sent.
  if (!pageCount) {

    if (verbose) {
      console.log('Obtaining total page count.');
    }

    posts.find({
      boardUri : boardUri,
      parent : {
        $exists : 0
      }
    }).count(false, null, function gotCount(error, count) {
      if (error) {
        callback(error);
      } else {

        var pages = Math.floor(count / pageSize) + (count % pageSize ? 1 : 0);

        pages += pages ? 0 : 1;

        exports.page(boardUri, page, callback, pages, boardData);
      }
    });

    return;
    // we allow for the basic board data to be informed, but fetch if not sent.
  } else if (!boardData) {

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
        exports.page(boardUri, page, callback, pageCount, board);
      }
    });

    return;
  }

  if (verbose) {

    var message = 'Generating page ' + page + '/' + pageCount;
    console.log(message + ' of board ' + boardUri);
  }
  // actual function start

  var toSkip = (page - 1) * pageSize;

  posts.find({
    boardUri : boardUri,
    parent : {
      $exists : 0
    }
  }, {
    postId : 1,
    content : 1,
    _id : 0,
    lastBump : 1,
  }).sort({
    lastBump : -1
  }).skip(toSkip).limit(pageSize).toArray(
      function(error, threads) {
        if (error) {
          callback(error);
        } else {
          domManipulator.page(jsdom(boardTemplate), boardUri, page, threads,
              pageCount, boardData, callback);
        }
      });

};

// page creation end

function pageIteration(boardUri, currentPage, pageCount, boardData, callback,
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
      pageIteration(boardUri, --currentPage, pageCount, boardData, callback,
          rebuildThreadPages);
    }
  }, pageCount, boardData);

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
      boardDescription : 1
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

  posts.find({
    boardUri : boardUri,
    parent : {
      $exists : 0
    }
  }).count(
      false,
      null,
      function gotCount(error, count) {
        if (error) {
          callback(error);
        } else {

          var pages = Math.floor(count / pageSize);
          pages += (count % pageSize ? 1 : 0);

          pages += pages ? 0 : 1;

          pageIteration(boardUri, pages, pages, boardData, callback,
              reloadThreads);
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
    boardDescription : 1
  });

  iterateBoards(cursor, callback);

};