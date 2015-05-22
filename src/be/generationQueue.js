'use strict';

// handles the page generation queue
// messages can have the following keys:
// globalRebuild (Boolean): rebuilds every single page
// defaultPages (Boolean): rebuilds default pages
// board: boardUri that will be rebuilt
// buildAll(Boolean): indicates to rebuild every of the board, including thread
// pages
// page(Number): page to be rebuilt
// thread(Number): thread to be rebuilt
// if only board is informed, its pages will be rebuilt without rebuilding the
// threads

// so we can know the order we will process the objects
var queueArray = [];

// so we can know more easily what we are going to rebuild,
// its structure is the following:
// each key will be a board URI with an object.
// each object will have the following fields: buildingAll, pages, threads.
// buildingPages indicates we are already rebuilding the board pages.
// buildingAll may hold a boolean so we know we are already rebuilding the whole
// board, ignore anything incoming for the board.
// pages is an array with the numbers of pages to be rebuilt, indexed from 1.
// [2,5] means we will rebuild pages 2 and 5
// threads is an array with the ids of threads to be rebuilt.
var queueTree = {};

// so we can just tell it is rebuilding everything and ignore any incoming
// requests
var rebuildingAll = false;
var rebuildingDefaultPages = false;
var working = false;
var debug = require('./boot').debug();
var generator = require('./engine/generator');
var verbose = require('./boot').getGeneralSettings().verbose;

function clearTree(error, message) {

  if (message.globalRebuild) {
    rebuildingAll = false;
    rebuildingDefaultPages = false;
  } else if (message.defaultPages) {
    rebuildingDefaultPages = false;
  } else if (message.buildAll) {
    delete queueTree[message.board];
  } else if (!message.page && !message.thread) {
    queueTree[message.board].buildingPages = false;
  } else if (message.page) {
    queueTree[message.board].pages.splice(queueTree[message.board].pages
        .indexOf(message.page), 1);

  } else {
    queueTree[message.board].threads.splice(queueTree[message.board].threads
        .indexOf(message.thread), 1);

  }

  processQueue();

  if (error) {
    if (verbose) {
      console.log(error);
    }

    if (debug) {
      throw error;
    }

  }

}

function processQueue() {
  if (!queueArray.length) {

    working = false;
    return;
  }

  working = true;

  var message = queueArray.shift();

  if (verbose) {
    console.log('Processing ' + JSON.stringify(message));
  }

  if (message.globalRebuild) {
    generator.all(function generated(error) {
      clearTree(error, message);
    });
  } else if (message.defaultPages) {
    generator.defaultPages(function generated(error) {
      clearTree(error, message);
    });
  } else if (message.buildAll) {
    generator.board(message.board, true, function generated(error) {
      clearTree(error, message);
    });
  } else if (!message.page && !message.thread) {
    generator.board(message.board, false, function generated(error) {
      clearTree(error, message);
    });
  } else if (message.page) {
    generator.page(message.board, message.page, function generated(error) {
      clearTree(error, message);
    });
  } else {
    generator.thread(message.board, message.thread, function generated(error) {
      clearTree(error, message);
    });
  }

}

function putInQueue(message, boardInformation) {

  if (boardInformation) {
    queueTree[message.board] = boardInformation;
  }

  queueArray.push(message);

  if (verbose) {
    console.log('Current queue tree :\n' + JSON.stringify(queueTree));
    console.log('Current queue array :\n' + JSON.stringify(queueArray));
  }

  if (!working) {
    processQueue();
  } else if (verbose) {
    console.log('Working, will not run processQueue');
  }

}

function checkForPageAndThreadRebuild(message, boardInformation) {

  var boardThreads = boardInformation.threads;
  var isRebuildingThread = boardThreads.indexOf(message.thread) !== -1;
  var isRebuildingPage = boardInformation.pages.indexOf(message.page) !== -1;

  if (isRebuildingThread || isRebuildingPage) {
    return;
  }

  if (message.thread) {

    boardThreads.push(message.thread);

  } else {

    boardInformation.pages.push(message.page);
  }

  putInQueue(message, boardInformation);

}

function checkForBoardRebuild(message) {

  var boardInformation = queueTree[message.board] || {
    buildingAll : false,
    buildingPages : false,
    pages : [],
    threads : []
  };

  if (boardInformation.buildingAll) {
    return;
  }

  if (message.buildAll) {
    boardInformation.buildingAll = true;

    putInQueue(message, boardInformation);
    return;
  }

  if (!message.thread && !message.page && boardInformation.buildingPages) {
    return;
  }

  if (!message.thread && !message.page) {
    boardInformation.buildingPages = true;

    putInQueue(message, boardInformation);

    return;
  }

  checkForPageAndThreadRebuild(message, boardInformation);
}

exports.queue = function(message) {

  if (verbose) {
    console.log('Queuing ' + JSON.stringify(message));
  }

  if (rebuildingAll) {
    return;
  }

  if (message.globalRebuild) {
    putInQueue(message);
    return;
  }

  if (rebuildingDefaultPages && message.defaultPages) {
    return;
  }

  if (message.defaultPages) {
    rebuildingDefaultPages = true;

    putInQueue(message);
    return;
  }

  checkForBoardRebuild(message);

};