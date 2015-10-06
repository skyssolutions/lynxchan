'use strict';

// handles the page generation queue

// to queue a rebuild, use process.send({message});

// messages can have the following keys:
// globalRebuild (Boolean): rebuilds every single page.
// log(Boolean): rebuild log pages.
// date(Date): indicates to rebuild only a specific date for logs.
// overboard (Boolean): rebuilds the overboard.
// allBoards (Boolean): rebuilds all boards.
// frontPage (Boolean): rebuilds the front-page.
// board: boardUri that will be rebuilt.
// catalog(Boolean): indicates to rebuild only the board catalog.
// rules(Boolean): indicates to rebuild only the board rules page.
// buildAll(Boolean): indicates to rebuild every page of the board, including
// thread pages.
// page(Number): page to be rebuilt.
// thread(Number): thread to be rebuilt.
// if only board is informed, its pages and catalog will be rebuilt without
// rebuilding the threads.

// so we can know the order we will process the objects
var queueArray = [];

var logDates = [];

// so we can know more easily what we are going to rebuild,
// its structure is the following:
// each key will be a board URI with an object.
// each object will have the following fields: buildingAll, pages, threads.
// buildingPages indicates we are already rebuilding the board pages.
// buildingAll may hold a boolean so we know we are already rebuilding the whole
// board, ignore anything incoming for the board.
// buildingCatalog indicates we are already building the catalog without the
// board pages.
// buildingRules indicates we are already building the board rules page.
// pages is an array with the numbers of pages to be rebuilt, indexed from 1.
// [2,5] means we will rebuild pages 2 and 5
// threads is an array with the ids of threads to be rebuilt.
var queueTree = {};

// so we can just tell it is rebuilding everything and ignore any incoming
// requests
var rebuildingAll = false;
var rebuildingAllBoards = false;
var rebuildingAllLogs = false;
var rebuildingOverboard = false;
// so we can tell its rebuilding the front-page
var rebuildingFrontPage = false;
var boot = require('./boot');
var debug = boot.debug();
var generator = require('./engine/generator');
var settings = require('./settingsHandler').getGeneralSettings();
var verbose = settings.verbose;
var concurrentMessages = 0;
var maxConcurrentMessages = settings.concurrentRebuildMessages;

exports.reload = function() {
  generator = require('./engine/generator');
  settings = require('./settingsHandler').getGeneralSettings();
  verbose = settings.verbose;
  maxConcurrentMessages = settings.concurrentRebuildMessages;
};

function clearGlobalRebuilding() {

  rebuildingAllLogs = false;
  rebuildingAll = false;
  rebuildingOverboard = false;
  rebuildingAllBoards = false;
  rebuildingFrontPage = false;
  return true;

}

function checkForGlobalClearing(message) {

  if (message.globalRebuild) {
    return clearGlobalRebuilding();
  } else if (message.log) {

    if (message.date) {
      logDates.splice(logDates.indexOf(message.date), 1);
    } else {
      logDates = [];
      rebuildingAllLogs = false;
    }

    return true;

  } else if (message.overboard) {
    rebuildingOverboard = false;
    return true;
  } else if (message.allBoards) {
    rebuildingAllBoards = false;
    return true;
  } else if (message.frontPage) {
    rebuildingFrontPage = false;
    return true;
  }

  return false;
}

function clearBoardTree(message) {

  if (message.buildAll) {
    delete queueTree[message.board];
  } else if (message.catalog) {
    queueTree[message.board].buildingCatalog = false;
  } else if (message.rules) {
    queueTree[message.board].buildingRules = false;
  } else if (!message.page && !message.thread) {
    queueTree[message.board].buildingPages = false;
    queueTree[message.board].buildingCatalog = false;
  } else if (message.page) {
    queueTree[message.board].pages.splice(queueTree[message.board].pages
        .indexOf(message.page), 1);

  } else {
    queueTree[message.board].threads.splice(queueTree[message.board].threads
        .indexOf(message.thread), 1);

  }

}

function clearTree(error, message) {

  if (!checkForGlobalClearing(message)) {
    clearBoardTree(message);
  }

  concurrentMessages--;

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

function debugPreGeneration() {

  try {
    boot.reload();

    generator = require('./engine/generator');
  } catch (error) {
    if (verbose) {
      console.log(error);
    }

    if (debug) {
      throw error;
    }
  }
}

function processMessageForBoards(generationCallback, message) {

  if (message.buildAll) {
    generator.board.board(message.board, true, true, generationCallback);
  } else if (message.catalog) {
    generator.board.catalog(message.board, generationCallback);
  } else if (message.rules) {
    generator.board.rules(message.board, generationCallback);
  } else if (!message.page && !message.thread) {
    generator.board.board(message.board, false, false, generationCallback);
  } else if (message.page) {
    generator.board.page(message.board, message.page, generationCallback);
  } else {
    generator.board.thread(message.board, message.thread, generationCallback);
  }

}

function processMessage(message) {

  var generationCallback = function(error) {
    clearTree(error, message);
  };

  if (debug) {
    debugPreGeneration();
  }

  if (message.globalRebuild) {
    generator.all(generationCallback);
  } else if (message.log) {

    if (message.date) {
      generator.global.log(new Date(message.date), generationCallback);
    } else {
      generator.global.logs(generationCallback);
    }

  } else if (message.overboard) {
    generator.global.overboard(generationCallback);
  } else if (message.allBoards) {
    generator.board.boards(generationCallback);
  } else if (message.frontPage) {
    generator.global.frontPage(generationCallback);
  } else {
    processMessageForBoards(generationCallback, message);
  }

}

function processQueue() {
  if (!queueArray.length) {

    return;
  }

  concurrentMessages++;

  var message = queueArray.shift();

  if (verbose) {
    console.log('Processing ' + JSON.stringify(message, null, 2));
  }

  processMessage(message);

}

function putInQueue(message, boardInformation) {

  if (boardInformation) {
    queueTree[message.board] = boardInformation;
  }

  queueArray.push(message);

  if (verbose) {
    console.log('Current queue tree :\n' + JSON.stringify(queueTree, null, 2));
    console
        .log('Current queue array :\n' + JSON.stringify(queueArray, null, 2));
  }

  if (concurrentMessages < maxConcurrentMessages) {
    if (verbose) {
      console.log('Idle, running processQueue');
    }

    processQueue();
  }

}

function checkForPageAndThreadRebuild(message, boardInformation) {

  if (!message.thread && !message.page && boardInformation.buildingPages) {
    return;
  }

  if (!message.thread && !message.page) {
    boardInformation.buildingPages = true;

    putInQueue(message, boardInformation);

    return;
  }

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

function checkBoardSpecialPages(message, boardInformation) {

  if (boardInformation.buildingRules && message.rules) {
    return;
  }

  if (message.rules) {
    boardInformation.buildingRules = true;
    putInQueue(message, boardInformation);
    return;
  }

  if (boardInformation.buildingCatalog && message.catalog) {
    return;
  }

  if (message.catalog) {
    boardInformation.buildingCatalog = true;
    putInQueue(message, boardInformation);
    return;
  }

  checkForPageAndThreadRebuild(message, boardInformation);
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

  checkBoardSpecialPages(message, boardInformation);
}

function checkForFullBoardRebuild(message) {

  if ((message.boardUri || message.allBoards) && rebuildingAllBoards) {
    return;
  }

  if (message.allBoards) {
    rebuildingAllBoards = true;
    putInQueue(message);
    return;
  }

  if (rebuildingFrontPage && message.frontPage) {
    return;
  }

  if (message.frontPage) {
    rebuildingFrontPage = true;

    putInQueue(message);
    return;
  }

  checkForBoardRebuild(message);

}

exports.checkForOverBoard = function(message) {

  if (rebuildingOverboard && message.overboard) {
    return;
  }

  if (message.overboard) {
    rebuildingOverboard = true;

    putInQueue(message);

    return;
  }

  checkForFullBoardRebuild(message);

};

exports.checkForLog = function(message) {

  var containsDate = message.date && logDates.indexOf(message.date) > -1;

  if (message.log && (rebuildingAllLogs || containsDate)) {
    return;
  }

  if (message.log) {

    if (message.date) {
      logDates.push(message.date);
    } else {
      rebuildingAllLogs = true;
    }

    putInQueue(message);

    return;
  }

  exports.checkForOverBoard(message);
};

exports.queue = function(message) {

  if (verbose) {
    console.log('Queuing ' + JSON.stringify(message, null, 2));
  }

  if (rebuildingAll) {
    return;
  }

  if (message.globalRebuild) {
    rebuildingAll = true;
    putInQueue(message);
    return;
  }

  exports.checkForLog(message);

};