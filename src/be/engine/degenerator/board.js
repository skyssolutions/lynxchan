'use strict';

var settingsHandler = require('../../settingsHandler');
var verbose;
var taskListener = require('../../taskListener');
var db = require('../../db');
var posts = db.posts();
var threads = db.threads();
var miscOps = require('../miscOps');
var files = db.files();
var cacheHandler;

exports.loadDependencies = function() {
  cacheHandler = require('../cacheHandler');
};

exports.loadSettings = function() {
  var settings = settingsHandler.getGeneralSettings();
  verbose = settings.verbose || settings.verboseGenerator;
};

exports.thread = function(boardUri, threadId, callback, direct) {

  if (verbose) {
    console.log('Degenerating thread ' + threadId + ' of board ' + boardUri);
  }

  var task = {
    cacheType : 'thread',
    threadId : threadId,
    boardUri : boardUri,
    type : 'cacheClear'
  };

  if (direct) {
    try {
      cacheHandler.clear(task);
      callback();
    } catch (error) {
      callback(error);
    }
  } else {
    taskListener.sendToSocket(null, task, callback);
  }

};

exports.page = function(boardUri, page, callback, direct) {

  if (verbose) {
    console.log('Degenerating page ' + page + ' of board ' + boardUri);
  }

  var task = {
    cacheType : 'page',
    page : page,
    boardUri : boardUri,
    type : 'cacheClear'
  };

  if (direct) {
    try {
      cacheHandler.clear(task);
      callback();
    } catch (error) {
      callback(error);
    }
  } else {
    taskListener.sendToSocket(null, task, callback);
  }

};

exports.catalog = function(boardUri, callback, direct) {

  if (verbose) {
    console.log('Degenerating catalog of ' + boardUri);
  }

  var task = {
    cacheType : 'catalog',
    boardUri : boardUri,
    type : 'cacheClear'
  };

  if (direct) {
    try {
      cacheHandler.clear(task);
      callback();
    } catch (error) {
      callback(error);
    }
  } else {
    taskListener.sendToSocket(null, task, callback);
  }

};

exports.board = function(boardUri, reloadThreads, reloadRules, cb, direct) {

  if (verbose) {
    console.log('Degenerating ' + boardUri);
  }

  var tasks = [ {
    type : 'cacheClear',
    boardUri : boardUri,
    cacheType : 'page'
  }, {
    type : 'cacheClear',
    boardUri : boardUri,
    cacheType : 'catalog'
  } ];

  if (reloadRules) {
    tasks.push({
      type : 'cacheClear',
      boardUri : boardUri,
      cacheType : 'rules'
    });
  }

  if (reloadThreads) {
    tasks.push({
      type : 'cacheClear',
      boardUri : boardUri,
      cacheType : 'thread'
    });
  }

  if (direct) {

    try {
      for (var i = 0; i < tasks.length; i++) {
        cacheHandler.clear(tasks[i]);
      }

      cb();
    } catch (error) {
      cb(error);
    }

    return;

  }

  taskListener.openSocket(function opened(error, socket) {

    if (error) {
      cb(error);
      return;
    }

    for (var i = 0; i < tasks.length; i++) {
      taskListener.sendToSocket(socket, tasks[i]);
    }

    taskListener.freeSocket(socket);

    cb();

  });

};

exports.rules = function(boardUri, callback, direct) {

  if (verbose) {
    console.log('Degenerating rules on ' + boardUri);
  }

  var task = {
    cacheType : 'rules',
    boardUri : boardUri,
    type : 'cacheClear'
  };

  if (direct) {
    try {
      cacheHandler.clear(task);
      callback();
    } catch (error) {
      callback(error);
    }
  } else {
    taskListener.sendToSocket(null, task, callback);
  }

};

exports.boards = function(callback, direct, innerCaches) {

  if (verbose) {
    console.log('Degenerating boards');
  }

  var task = {
    cacheType : 'boards',
    type : 'cacheClear'
  };

  var innerCb = function(error) {

    if (error) {
      return callback(error);
    }

    if (direct) {
      try {
        cacheHandler.clear(task);
        callback();
      } catch (error) {
        callback(error);
      }
    } else {
      taskListener.sendToSocket(null, task, callback);
    }

  };

  if (!innerCaches) {
    return innerCb();
  }

  threads.updateMany({}, {
    $unset : miscOps.individualCaches
  }, function(error) {

    if (error) {
      return callback(error);
    }

    posts.updateMany({}, {
      $unset : miscOps.individualCaches
    }, innerCb);

  });

};
