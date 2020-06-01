'use strict';

var kernel = require('../kernel');
var feDebug = kernel.feDebug();
var db = require('../db');
var boards = db.boards();
var taskListener = require('../taskListener');
var threads = db.threads();
var posts = db.posts();
var aggregatedLogs = db.aggregatedLogs();
var generator;
var cacheHandler;
var gridFsHandler;
var templateHandler;
var multiBoardAllowed;
var overboardPages;
var overboardAlternativePages = [ '1.json', 'index.rss', '' ];
var catalogPages = [ 'catalog.html', 'catalog.json', 'index.rss' ];
var rulesPages = [ 'rules.html', 'rules.json' ];
var threadPages = [ 'res', 'last' ];

exports.loadSettings = function() {

  var settings = require('../settingsHandler').getGeneralSettings();

  multiBoardAllowed = settings.multiboardThreadCount;

  overboardPages = [];

  if (settings.overboard) {
    overboardPages.push(settings.overboard);
  }

  if (settings.sfwOverboard) {
    overboardPages.push(settings.sfwOverboard);
  }

};

exports.loadDependencies = function() {
  templateHandler = require('./templateHandler');
  generator = require('./generator');
  cacheHandler = require('./cacheHandler');
  gridFsHandler = require('./gridFsHandler');
};

exports.generateThreadCache = function(lockData, boardData, callback) {

  threads.findOne({
    threadId : lockData.postingId,
    boardUri : lockData.boardUri
  }, function gotThread(error, thread) {

    if (error || !thread) {
      callback(error, !thread);
    } else {
      generator.board.thread(lockData.boardUri, lockData.postingId, callback,
          boardData, thread);
    }

  });

};

exports.generateBoardCache = function(lockData, callback) {

  boards.findOne({
    boardUri : lockData.boardUri
  }, {
    projection : generator.board.boardProjection
  },
      function gotBoard(error, board) {

        if (error || !board) {
          callback(error, true);
        } else {

          switch (lockData.type) {

          case 'page': {
            generator.board.page(lockData.boardUri, lockData.page, callback,
                board);
            break;
          }

          case 'rules': {
            generator.board.rules(lockData.boardUri, callback);
            break;
          }

          case 'catalog': {
            generator.board.catalog(lockData.boardUri, callback, board);
            break;
          }

          case 'thread': {
            exports.generateThreadCache(lockData, board, callback);
            break;
          }

          }

        }

      });

};

exports.generateCache = function(lockData, callback) {

  switch (lockData.type) {

  case 'multiboard': {
    generator.global.multiboard(lockData.boards, callback);
    break;
  }

  case 'rules':
  case 'catalog':
  case 'thread':
  case 'page': {
    exports.generateBoardCache(lockData, callback);
    break;
  }

  case 'index': {
    generator.global.frontPage(callback);
    break;
  }

  case 'overboard': {
    generator.global.overboard(callback);
    break;
  }

  case 'log': {

    aggregatedLogs.findOne({
      date : lockData.date,
      boardUri : lockData.boardUri === '.global' ? null : lockData.boardUri
    }, function gotLogData(error, data) {

      if (error || !data) {
        callback(error, !data);
      } else {
        generator.global.log(lockData.date, callback, data);
      }

    });

    break;
  }

  }

};

exports.getThreadLockData = function(fileParts) {

  if (threadPages.indexOf(fileParts[2]) < 0) {
    return;
  }

  var matches = fileParts[3].match(/^(\d+).(html|json)$/);

  if (matches) {

    return {
      boardUri : fileParts[1],
      type : 'thread',
      postingId : +matches[1]
    };

  }

};

exports.getLogLockData = function(fileParts) {

  if (fileParts.length !== 5) {
    return;
  }

  var boardUri = fileParts[3];
  var matches = fileParts[4].match(/^(\d{4})-(\d{2})-(\d{2})\.(html|json)$/);

  if (!matches) {
    return;
  }

  var date = new Date();

  date.setUTCHours(0);
  date.setUTCMinutes(0);
  date.setUTCSeconds(0);
  date.setUTCMilliseconds(0);
  date.setUTCFullYear(matches[1]);
  date.setUTCMonth(matches[2] - 1);
  date.setUTCDate(matches[3]);

  return {
    boardUri : boardUri,
    date : date,
    type : 'log'
  };

};

exports.getGlobalLockData = function(fileParts) {

  if (fileParts[1] === '.global' && fileParts[2] === 'logs') {
    return exports.getLogLockData(fileParts);
  } else if (fileParts.length !== 2) {
    return;
  } else if (!fileParts[1] || fileParts[1] === 'index.json') {
    return {
      type : 'index'
    };
  }

};

exports.getOverboardLockData = function(fileParts) {

  if (fileParts.length > 3) {
    return;
  }

  if (overboardAlternativePages.indexOf(fileParts[2]) > -1) {
    return {
      type : 'overboard'
    };
  }

};

exports.getBoardLock = function(fileParts) {

  if (fileParts.length === 4) {
    return exports.getThreadLockData(fileParts);
  } else if (fileParts.length === 3) {

    if (!fileParts[2]) {
      return {
        boardUri : fileParts[1],
        page : 1,
        type : 'page'
      };
    }

    var matches = fileParts[2].match(/^(\d+)\.(html|json)$/);

    if (matches && +matches[1]) {

      return {
        boardUri : fileParts[1],
        page : +matches[1],
        type : 'page'
      };

    } else if (catalogPages.indexOf(fileParts[2]) > -1) {

      return {
        boardUri : fileParts[1],
        type : 'catalog'
      };

    } else if (rulesPages.indexOf(fileParts[2]) > -1) {

      return {
        boardUri : fileParts[1],
        type : 'rules'
      };

    }

  }

};

exports.getLockData = function(file, boards) {

  if (!file) {
    return;
  }

  if (boards) {
    return {
      type : 'multiboard',
      boards : boards
    };
  }

  var fileParts = file.split('/');

  if (fileParts[0]) {
    return;
  }

  if (!fileParts[1] || /\W/.test(fileParts[1])) {
    return exports.getGlobalLockData(fileParts);
  } else if (overboardPages.indexOf(fileParts[1]) > -1) {
    return exports.getOverboardLockData(fileParts);
  } else {
    return exports.getBoardLock(fileParts);
  }

};

exports.finishedCacheGeneration = function(lockData, error, notFound, cb) {

  taskListener.sendToSocket(null, {
    type : 'deleteLock',
    lockData : lockData
  }, function deletedLock(deletionError) {
    cb(error || deletionError, notFound, true);
  });

};

exports.waitForUnlock = function(callback, lockData, attempts) {

  attempts = attempts || 0;

  if (attempts > 9) {

    taskListener.sendToSocket(null, {
      type : 'deleteLock',
      lockData : lockData
    }, callback);

    return;
  }

  cacheHandler.getLock(lockData, true, function found(error, isLocked) {

    if (error) {
      callback(error);
    } else if (isLocked) {
      setTimeout(function() {
        exports.waitForUnlock(callback, lockData, ++attempts);
      }, 500);
    } else {
      callback();
    }

  });

};

exports.checkCache = function(file, boards, callback) {

  var lockData = exports.getLockData(file, boards);

  if (!lockData) {
    callback(null, true);
    return;
  }

  cacheHandler.getLock(lockData, false, function gotLock(error, isLocked) {

    if (error) {
      callback(error);
    } else if (!isLocked) {

      if (feDebug) {
        templateHandler.dropAlternativeTemplates();
        templateHandler.loadTemplates();
      }

      // style exception, too simple
      exports.generateCache(lockData, function generatedCache(error, notFound) {
        exports.finishedCacheGeneration(lockData, error, notFound, callback);
      });
      // style exception, too simple

    } else {
      exports.waitForUnlock(callback, lockData);
    }

  });
};
