'use strict';

// handles generation of pages based on templates

var frontPageTemplate;
var threadTemplate;
var boardTemplate;
var notFoundTemplate;

var db = require('../db');
var posts = db.posts();
var boards = db.boards();
var gridFs = require('./gridFsHandler');
var fs = require('fs');
var boot = require('../boot');
var settings = boot.getGeneralSettings();
var pageSize = settings.pageSize;
var verbose = settings.verbose;
var serializer = require('jsdom').serializeDocument;
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

  // TODO
  gridFs.writeData(notFoundTemplate, '/404.html', 'text/html', {
    status : 404
  }, callback);
};

function generateFrontPage(boardsToList, callback) {

  if (verbose) {
    console.log('Got boards\n' + JSON.stringify(boardsToList));

  }

  var document = jsdom(frontPageTemplate);

  var boardsDiv = document.getElementById('divBoards');

  if (!boardsDiv) {
    callback('No board div on front-end template');
    return;
  }

  for (var i = 0; i < boardsToList.length; i++) {

    var board = boardsToList[i];

    var block = '<a href="' + board.boardUri + '">';
    block += '/' + board.boardUri + '/ - ' + board.boardName + '</a>';

    if (i) {
      block = '<br>' + block;
    }

    boardsDiv.innerHTML += block;

  }

  gridFs.writeData(serializer(document), '/', 'text/html', {}, callback);
}

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
      generateFrontPage(results, callback);
    }
  });

};

// board creation start
// page creation start
function generateThreadListing(document, boardUri, page, threads, callback) {

  var threadsDiv = document.getElementById('divThreads');

  if (!threadsDiv) {
    callback('No threads div on board page template');
    return;
  }

  var includedThreads = [];

  for (var i = 0; i < threads.length; i++) {
    var thread = threads[i];

    includedThreads.push(thread.postId);

    if (i) {
      threadsDiv.innerHTML += '<br>';
    }

    var content = thread.postId + '<a href="' + thread.postId + '.html' + '">';
    content += 'Reply</a>';

    threadsDiv.innerHTML += content;

  }

  var ownName = page === 1 ? '' : page + '.html';

  gridFs.writeData(serializer(document), '/' + boardUri + '/' + ownName,
      'text/html', {
        boardUri : boardUri,
        type : 'board'
      }, callback);

}

function setPagesListing(document, callback, pageCount, boardUri) {
  var pagesDiv = document.getElementById('divPages');

  if (!pagesDiv) {
    callback('No pages div on board page template');
    return false;
  }

  var pagesContent = '';

  for (var i = 0; i < pageCount; i++) {

    var pageName = i ? (i + 1) + '.html' : 'index.html';

    pagesContent += '<a href="' + pageName + '">' + (i + 1) + '</a>  ';

  }

  pagesDiv.innerHTML = pagesContent;

  return true;
}

function setBoardTitleAndDescription(document, callback, boardUri, boardData) {

  var titleHeader = document.getElementById('labelName');

  if (!titleHeader) {
    callback('No title header on board page template');
    return false;
  }

  titleHeader.innerHTML = boardUri;

  var descriptionHeader = document.getElementById('labelDescription');

  if (!descriptionHeader) {
    callback('No description header on board page template');
    return false;
  }

  titleHeader.innerHTML = '/' + boardUri + '/ - ' + boardData.boardName;
  descriptionHeader.innerHTML = boardData.boardDescription;

  return true;

}

function generatePage(boardUri, page, pageCount, boardData, callback) {

  var document = jsdom(boardTemplate);

  var boardIdentifyInput = document.getElementById('boardIdentifier');

  if (!boardIdentifyInput) {
    callback('No board identify input on board template page');
    return;
  }

  boardIdentifyInput.setAttribute('value', boardUri);

  if (!setBoardTitleAndDescription(document, callback, boardUri, boardData)) {
    return;
  }

  if (!setPagesListing(document, callback, pageCount, boardUri)) {
    return;
  }

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
  }).skip(toSkip).limit(pageSize).toArray(function(error, threads) {
    if (error) {
      callback(error);
    } else {
      generateThreadListing(document, boardUri, page, threads, callback);
    }
  });

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

  generatePage(boardUri, page, pageCount, boardData, callback);

};

// page creation end

function pageIteration(boardUri, currentPage, pageCount, boardData, callback) {

  if (currentPage < 1) {
    callback();
    return;
  }

  exports.page(boardUri, currentPage, function createdPage(error) {
    if (error) {
      callback(error);
    } else {
      pageIteration(boardUri, --currentPage, pageCount, boardData, callback);
    }
  }, pageCount, boardData);

}

// TODO generate only first X pages

exports.board = function(boardUri, callback, boardData) {

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
        exports.board(boardUri, callback, board);
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
  }).count(false, null, function gotCount(error, count) {
    if (error) {
      callback(error);
    } else {

      var pages = Math.floor(count / pageSize) + (count % pageSize ? 1 : 0);

      pages += pages ? 0 : 1;

      pageIteration(boardUri, pages, pages, boardData, callback);
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
      exports.board(board.boardUri, function generatedBoard(error) {

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