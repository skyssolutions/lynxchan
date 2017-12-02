'use strict';

var settingsHandler = require('../../settingsHandler');
var verbose;
var taskListener = require('../../taskListener');
var db = require('../../db');
var files = db.files();
var cacheHandler;
var socketLocation;
var Socket = require('net').Socket;

exports.loadDependencies = function() {
  cacheHandler = require('../cacheHandler');
};

exports.loadSettings = function() {
  var settings = settingsHandler.getGeneralSettings();
  verbose = settings.verbose || settings.verboseGenerator;
  socketLocation = settings.tempDirectory;
  socketLocation += '/unix.socket';
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
    cacheHandler.clear(task);
    callback();
  } else {
    taskListener.sendToSocket(socketLocation, task, callback);
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
    cacheHandler.clear(task);
    callback();
  } else {
    taskListener.sendToSocket(socketLocation, task, callback);
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
    cacheHandler.clear(task);
    callback();
  } else {
    taskListener.sendToSocket(socketLocation, task, callback);
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
    for (var i = 0; i < tasks.length; i++) {
      cacheHandler.clear(tasks[i]);
    }

    cb();

  } else {

    var client = new Socket();

    client.on('end', cb);
    client.on('error', cb);

    client.connect(socketLocation, function() {

      for (var i = 0; i < tasks.length; i++) {
        taskListener.sendToSocket(client, tasks[i]);
      }

      client.end();
    });
  }

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
    cacheHandler.clear(task);
    callback();
  } else {
    taskListener.sendToSocket(socketLocation, task, callback);
  }

};

exports.boards = function(callback, direct) {

  if (verbose) {
    console.log('Degenerating boards');
  }

  var task = {
    cacheType : 'boards',
    type : 'cacheClear'
  };

  if (direct) {
    cacheHandler.clear(task);
    callback();
  } else {
    taskListener.sendToSocket(socketLocation, task, callback);
  }

};
