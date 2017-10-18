'use strict';

var kernel = require('../kernel');
var feDebug = kernel.feDebug();
var debug = kernel.debug();
var db = require('../db');
var boards = db.boards();
var threads = db.threads();
var posts = db.posts();
var aggregatedLogs = db.aggregatedLogs();
var cacheLocks = db.cacheLocks();
var generator;
var gridFsHandler;
var templateHandler;
var overboardPages;
var overboardAlternativePages = [ '1.json', 'index.rss', '' ];
var catalogPages = [ 'catalog.html', 'catalog.json', 'index.rss' ];
var rulesPages = [ 'rules.html', 'rules.json' ];

exports.loadSettings = function() {

  var settings = require('../settingsHandler').getGeneralSettings();

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

exports.generatePreviewCache = function(lockData, callback) {

  posts.findOne({
    boardUri : lockData.boardUri,
    postId : lockData.postingId
  }, function gotPost(error, post) {

    if (error) {
      callback(error);
    } else if (!post) {

      // style exception, too simple
      threads.findOne({
        threadId : lockData.postingId,
        boardUri : lockData.boardUri
      }, function gotThread(error, thread) {

        if (error || !thread) {
          callback(error, !thread);
        } else {
          generator.previews.preview(lockData.boardUri, lockData.postingId,
              null, callback, thread);
        }

      });
      // style exception, too simple

    } else {
      generator.previews.preview(lockData.boardUri, null, lockData.postingId,
          callback, post);
    }

  });

};

exports.generateBoardCache = function(lockData, callback) {

  boards.findOne({
    boardUri : lockData.boardUri
  }, generator.board.boardProjection,
      function gotBoard(error, board) {

        if (error || !board) {
          callback(error, true);
        } else {

          switch (lockData.type) {

          case 'board': {
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

          case 'preview': {
            exports.generatePreviewCache(lockData, callback);
            break;
          }

          }

        }

      });

};

exports.generateCache = function(lockData, callback) {

  if (feDebug && !debug) {
    templateHandler.dropAlternativeTemplates();
    templateHandler.loadTemplates();
  }

  switch (lockData.type) {

  case 'rules':
  case 'catalog':
  case 'preview':
  case 'thread':
  case 'board': {
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
      date : lockData.date
    }, function gotLogData(error, data) {

      if (error || !data) {
        callback(error, !data);
      } else {
        generator.global.log(lockData.date, callback, data);
      }

    });

    break;
  }

  default: {
    console.log('Warning: unknown lock type ' + lockData.type);
    callback(null, true);
  }
    break;

  }

};

exports.getThreadOrPreviewLockData = function(fileParts) {

  if (fileParts[2] !== 'res' && fileParts[2] !== 'preview') {
    return;
  }

  var matches = fileParts[3].match(/^(\d+).(html|json)$/);

  if (matches) {

    return {
      boardUri : fileParts[1],
      type : fileParts[2] === 'res' ? 'thread' : 'preview',
      postingId : +matches[1]
    };

  }

};

exports.getLogLockData = function(fileParts) {

  if (fileParts.length > 4) {
    return;
  }

  var matches = fileParts[3].match(/^(\d{4})-(\d{2})-(\d{2})\.(html|json)$/);

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

exports.getLockData = function(file) {

  var fileParts = (file || '').split('/');

  if (!fileParts[1] || /\W/.test(fileParts[1])) {
    return exports.getGlobalLockData(fileParts);
  } else if (overboardPages.indexOf(fileParts[1]) > -1) {
    return exports.getOverboardLockData(fileParts);
  } else {

    if (fileParts.length === 4) {
      return exports.getThreadOrPreviewLockData(fileParts);
    } else if (fileParts.length === 3) {

      if (!fileParts[2]) {
        return {
          boardUri : fileParts[1],
          page : 1,
          type : 'board'
        };
      }

      var matches = fileParts[2].match(/^(\d+)\.(html|json)$/);

      if (matches) {

        return {
          boardUri : fileParts[1],
          page : +matches[1],
          type : 'board'
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

  }

};

exports.finishedCacheGeneration = function(lockData, error, notFound, file,
    req, res, cookies, callback) {

  cacheLocks.deleteOne(lockData, function deletedLock(deletionError) {

    if (error) {
      callback(error);
    } else if (deletionError) {
      callback(deletionError);
    } else {
      gridFsHandler.outputFile(notFound ? '/404.html' : file, req, res,
          callback, cookies);
    }

  });

};

exports.waitForUnlock = function(file, req, res, callback, cookies, lockData,
    attempts) {

  attempts = attempts || 0;

  if (attempts > 9) {

    cacheLocks.deleteOne(lockData, function deleted(error) {

      if (error) {
        callback(error);
      } else {
        gridFsHandler.outputFile(file, req, res, callback, cookies);
      }

    });

    return;
  }

  cacheLocks.findOne(lockData, function found(error, foundLock) {

    if (error) {
      callback(error);
    } else if (foundLock) {
      setTimeout(function() {
        exports.waitForUnlock(file, req, res, callback, cookies, lockData,
            ++attempts);
      }, 500);
    } else {
      gridFsHandler.outputFile(file, req, res, callback, cookies);
    }

  });

};

exports.checkCache = function(file, req, res, cookies, callback) {

  var lockData = exports.getLockData(file);

  if (!lockData) {
    gridFsHandler.outputFile('/404.html', req, res, callback, cookies);
    return;
  }

  cacheLocks.findOneAndUpdate(lockData, lockData, {
    upsert : true
  }, function gotLock(error, result) {

    if (error) {
      callback(error);
    } else if (!result.value) {

      // style exception, too simple
      exports.generateCache(lockData, function generatedCache(error, notFound) {

        exports.finishedCacheGeneration(lockData, error, notFound, file, req,
            res, cookies, callback);

      });
      // style exception, too simple

    } else {
      exports.waitForUnlock(file, req, res, callback, cookies, lockData);
    }

  });
};
