'use strict';

// handles the page generation queue

// to queue a rebuild, use process.send({message});

// messages can have the following keys:
// globalRebuild (Boolean): rebuilds every single page.
// log(Boolean): rebuild log pages.
// login(Boolean): rebuilds login page.
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
// post(Number): post to be rebuilt.
// if only board is informed, its pages and catalog will be rebuilt without
// rebuilding the threads.

// so we can know the order we will process the objects
var queueArray = [];

var logDates = [];

// so we can know more easily what we are going to rebuild,
// its structure is the following:
// each key will be a board URI with an object.
// each object will have the following fields: buildingPages, buildingAll,
// pages, threads, buildingCatalog, buildingRules.
// buildingPages indicates we are already rebuilding the board pages.
// buildingAll may hold a boolean so we know we are already rebuilding the whole
// board, ignore anything else incoming for the board.
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
var rebuildingLogin = false;
var rebuildingAllBoards = false;
var rebuildingAllLogs = false;
var rebuildingOverboard = false;
// so we can tell its rebuilding the front-page
var rebuildingFrontPage = false;
var kernel = require('./kernel');
var debug = kernel.debug();
var feDebug = kernel.feDebug();
var generator = require('./engine/generator');
var degenerator = require('./engine/degenerator');
var http = require('http');
var db = require('./db');
var rebuildMessages = db.messages();
var settings = require('./settingsHandler').getGeneralSettings();
var verbose = settings.verbose || settings.verboseQueue;
var currentSlave = 0;
var concurrentMessages = 0;
var MAX_TRIES = 4;
var maxConcurrentMessages = settings.concurrentRebuildMessages;
var preemptive = settings.preemptiveCaching;

exports.loadUnfinishedMessages = function() {

  rebuildMessages.find().toArray(function gotMessages(error, messages) {

    if (error) {
      console.log(error);
    } else {
      for (var i = 0; i < messages.length; i++) {
        exports.queue(messages[i]);
      }

    }

  });

};

exports.reload = function() {
  generator = require('./engine/generator');
  degenerator = require('./engine/degenerator');
  settings = require('./settingsHandler').getGeneralSettings();
  verbose = settings.verbose || settings.verboseQueue;
  preemptive = settings.preemptiveCaching;
  maxConcurrentMessages = settings.concurrentRebuildMessages;
};

function clearBoardTree(message) {

  if (message.buildAll) {

    queueTree[message.board].buildingAll = false;
    queueTree[message.board].buildingPages = false;
    queueTree[message.board].pages = [];
    queueTree[message.board].threads = [];
    queueTree[message.board].buildingCatalog = false;
    queueTree[message.board].buildingRules = false;

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

function clearGlobalRebuilding() {

  rebuildingAllLogs = false;
  rebuildingAll = false;
  rebuildingLogin = false;
  rebuildingOverboard = false;
  rebuildingAllBoards = false;
  rebuildingFrontPage = false;

}

function clearLog(message) {
  if (message.date) {
    logDates.splice(logDates.indexOf(message.date), 1);
  } else {
    logDates = [];
    rebuildingAllLogs = false;
  }
}

function clearTree(message) {

  if (message._id) {
    rebuildMessages.deleteOne({
      _id : message._id
    });
  }

  if (message.globalRebuild) {
    clearGlobalRebuilding();
    return;
  } else if (message.log) {
    return clearLog(message);
  } else if (message.overboard) {
    rebuildingOverboard = false;
    return;
  } else if (message.allBoards) {
    rebuildingAllBoards = false;
    return;
  } else if (message.frontPage) {
    rebuildingFrontPage = false;
    return;
  } else if (message.login) {
    rebuildingLogin = false;
    return;
  }

  clearBoardTree(message);
}

function debugPreGeneration() {

  try {
    kernel.reload();
  } catch (error) {
    throw error;
  }
}

function processMessageForBoards(message, callback) {

  if (message.buildAll) {
    generator.board.board(message.board, true, true, callback);
  } else if (message.catalog) {
    generator.board.catalog(message.board, callback);
  } else if (message.rules) {
    generator.board.rules(message.board, callback);
  } else if (!message.page && !message.thread) {
    generator.board.board(message.board, false, false, callback);
  } else if (message.page) {
    generator.board.page(message.board, message.page, callback);
  } else {
    generator.board.thread(message.board, message.thread, callback);
  }

}

exports.processMessage = function(message, callback) {

  if (debug) {
    debugPreGeneration();
  } else if (feDebug) {
    var templateHandler = require('./engine/templateHandler');
    templateHandler.dropAlternativeTemplates();
    templateHandler.loadTemplates();
  }

  if (message.globalRebuild) {
    generator.all(callback);
  } else if (message.log) {

    if (message.date) {
      generator.global.log(new Date(message.date), callback);
    } else {
      generator.global.logs(callback);
    }

  } else if (message.overboard) {
    generator.global.overboard(callback);
  } else if (message.allBoards) {
    generator.board.boards(callback);
  } else if (message.frontPage) {
    generator.global.frontPage(callback);
  } else if (message.login) {
    generator.global.login(callback);
  } else {
    processMessageForBoards(message, callback);
  }

};

function getAddressToRebuild() {

  if (settings.master) {
    return settings.master;
  } else {

    var slaveToUse = settings.slaves[currentSlave++];

    if (currentSlave >= settings.slaves.length) {
      currentSlave = 0;
    }

    return slaveToUse;
  }

}

function handleRequestResult(error, message) {

  if (!message.clearBeforeRebuild) {
    clearTree(message);
  }

  if (error) {

    if (debug) {
      throw error;
    } else {
      console.log(error);
    }

  }

  concurrentMessages--;

  processQueue();

}

function sendMessageByHttp(message, callback, error, retries) {

  retries = retries || 0;

  if (retries >= MAX_TRIES) {
    callback(error);
    return;
  }

  if (verbose) {
    console.log('Try ' + retries);
  }

  retries++;

  var address = getAddressToRebuild();

  if (verbose) {
    console.log('Sending rebuild message to ' + address);
  }

  var req = http.request({
    hostname : address,
    port : settings.port,
    path : '/.api/takeMessage.js',
    method : 'POST'
  }, function gotResponse(res) {

    if (res.statusCode !== 200) {

      sendMessageByHttp(message, callback, 'Request status ' + res.statusCode,
          retries);
      return;
    }

    var response = '';

    res.on('data', function(data) {

      response += data;
    });

    res.on('end', function() {

      try {

        var parsedResponse = JSON.parse(response);

        if (parsedResponse.status === 'ok') {
          callback();
        } else {
          sendMessageByHttp(message, callback, parsedResponse.data, retries);
        }

      } catch (error) {
        sendMessageByHttp(message, callback, error, retries);
      }

    });

  });

  req.on('error', function(error) {
    sendMessageByHttp(message, callback, error, retries);
  });

  req.write(JSON.stringify({
    parameters : message
  }));
  req.end();

}

function getNextQueueItem() {

  var lowestExpiration = Infinity;
  var lowestIndex;

  for (var i = 0; i < queueArray.length; i++) {
    var currentExpiration = queueArray[i].expiration;

    if (currentExpiration < lowestExpiration) {
      lowestIndex = i;
      lowestExpiration = currentExpiration;
    }

  }

  return queueArray.splice(lowestIndex, 1)[0];
}

function deleteCacheForBoards(message, callback) {

  if (message.buildAll) {
    degenerator.board.board(message.board, true, true, callback);
  } else if (message.catalog) {
    degenerator.board.catalog(message.board, callback);
  } else if (message.rules) {
    degenerator.board.rules(message.board, callback);
  } else if (!message.page && !message.thread) {
    degenerator.board.board(message.board, false, false, callback);
  } else if (message.page) {
    degenerator.board.page(message.board, message.page, callback);
  } else {
    degenerator.board.thread(message.board, message.thread, callback);
  }

}

exports.deleteCache = function(message, callback) {

  if (message.globalRebuild) {
    degenerator.all(callback);
  } else if (message.log) {

    if (message.date) {
      degenerator.global.log(new Date(message.date), callback);
    } else {
      degenerator.global.logs(callback);
    }

  } else if (message.overboard) {
    degenerator.global.overboard(callback);
  } else if (message.allBoards) {
    degenerator.board.boards(callback);
  } else if (message.frontPage) {
    degenerator.global.frontPage(callback);
  } else if (message.login) {
    degenerator.global.login(callback);
  } else {
    deleteCacheForBoards(message, callback);
  }

};

function processQueue() {

  if (!queueArray.length || kernel.shuttingDown) {
    return;
  }

  concurrentMessages++;

  var message = getNextQueueItem();

  if (verbose) {
    console.log('\nProcessing ' + JSON.stringify(message, null, 2));
  }

  if (message.clearBeforeRebuild) {
    clearTree(message);
  }

  var generationCallBack = function(error) {
    handleRequestResult(error, message);
  };

  if (!preemptive) {
    exports.deleteCache(message, generationCallBack);
  } else if (settings.slaves.length) {
    sendMessageByHttp(message, generationCallBack);
  } else {
    exports.processMessage(message, generationCallBack);
  }

}

function checkMessageCount() {

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

function putInQueue(message, boardInformation, priority, clearBeforeRebuild) {

  if (boardInformation) {
    queueTree[message.board] = boardInformation;
  }

  var expiration = new Date();

  if (priority) {
    expiration.setSeconds(expiration.getSeconds() + priority);
  }

  message.clearBeforeRebuild = clearBeforeRebuild;
  message.expiration = expiration;

  queueArray.push(message);

  if (!message._id) {
    rebuildMessages.insertOne(message, function insertedMessage(error) {

      if (error) {
        console.log();
      }

      checkMessageCount();

    });
  } else {
    checkMessageCount();
  }

}

function checkForPageAndThreadRebuild(message, boardInformation) {

  if (!message.thread && !message.page && boardInformation.buildingPages) {
    return;
  }

  if (!message.thread && !message.page) {
    boardInformation.buildingPages = true;

    putInQueue(message, boardInformation, 30);

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

  putInQueue(message, boardInformation, message.thread ? 0 : 30,
      message.thread ? true : false);

}

function checkBoardSpecialPages(message, boardInformation) {

  if (boardInformation.buildingRules && message.rules) {
    return;
  }

  if (message.rules) {
    boardInformation.buildingRules = true;
    putInQueue(message, boardInformation, 30, true);
    return;
  }

  if (boardInformation.buildingCatalog && message.catalog) {
    return;
  }

  if (message.catalog) {
    boardInformation.buildingCatalog = true;
    putInQueue(message, boardInformation, 15);
    return;
  }

  checkForPageAndThreadRebuild(message, boardInformation);
}

function checkForBoardRebuild(message) {

  var boardInformation = queueTree[message.board] || {
    buildingAll : false,
    buildingPages : false,
    buildingCatalog : false,
    rules : false,
    pages : [],
    threads : []
  };

  if (boardInformation.buildingAll) {
    return;
  }

  if (message.buildAll) {
    boardInformation.buildingAll = true;

    putInQueue(message, boardInformation, 60, true);
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
    putInQueue(message, null, 60, true);
    return;
  }

  if (rebuildingFrontPage && message.frontPage) {
    return;
  }

  if (message.frontPage) {
    rebuildingFrontPage = true;

    putInQueue(message, null, 60);
    return;
  }

  checkForBoardRebuild(message);

}

exports.checkForOverBoardAndLogin = function(message) {

  if (rebuildingOverboard && message.overboard) {
    return;
  }

  if (message.overboard) {
    rebuildingOverboard = true;

    putInQueue(message, null, 30);

    return;
  }

  if (rebuildingLogin && message.login) {
    return;
  }

  if (message.login) {
    rebuildingLogin = true;
    putInQueue(message, null, 60);
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

    putInQueue(message, null, 60, true);

    return;
  }

  exports.checkForOverBoardAndLogin(message);
};

exports.queue = function(message) {

  if (verbose) {
    console.log('Queuing ' + JSON.stringify(message, null, 2));
  }

  if (settings.master) {

    if (verbose) {
      console.log('Sending message to master node');
    }

    sendMessageByHttp(message, function sentMessage(error) {
      if (error) {

        if (debug) {
          throw error;
        } else if (verbose) {
          console.log(error);
        }

      }
    });

    return;
  }

  if (rebuildingAll) {
    return;
  }

  if (message.globalRebuild) {
    rebuildingAll = true;
    putInQueue(message, null, 60, true);
    return;
  }

  exports.checkForLog(message);

};