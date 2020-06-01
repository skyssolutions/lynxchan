'use strict';

// handles the page generation queue

var kernel = require('./kernel');
var feDebug = kernel.feDebug();
var degenerator;
var verbose;
var taskListener;
var master;

exports.reload = function() {
  taskListener = require('./taskListener');
  degenerator = require('./engine/degenerator');
  var settings = require('./settingsHandler').getGeneralSettings();
  verbose = settings.verbose || settings.verboseQueue;
  master = settings.master;
};

function deleteCacheForBoards(message, callback) {

  if (message.buildAll) {
    degenerator.board.board(message.board, true, true, callback, true);
  } else if (message.catalog) {
    degenerator.board.catalog(message.board, callback, true);
  } else if (message.rules) {
    degenerator.board.rules(message.board, callback, true);
  } else if (!message.page && !message.thread) {
    degenerator.board.board(message.board, false, false, callback, true);
  } else if (message.page) {
    degenerator.board.page(message.board, message.page, callback, true);
  } else {
    degenerator.board.thread(message.board, message.thread, callback, true);
  }

}

exports.deleteCache = function(message, callback) {

  if (message.globalRebuild) {
    degenerator.all(callback, true);
  } else if (message.multiboard && typeof message.multiboard === 'boolean') {
    degenerator.global.multiboard(callback, message.board, true);
  } else if (message.log && message.date) {
    degenerator.global.log(new Date(message.date), callback, true);
  } else if (message.log) {
    degenerator.global.logs(callback, true, message.clearInner);
  } else if (message.overboard) {
    degenerator.global.overboard(callback, true);
  } else if (message.allBoards) {
    degenerator.board.boards(callback, true, message.clearInner);
  } else if (message.frontPage) {
    degenerator.global.frontPage(callback, true);
  } else if (message.login) {
    degenerator.global.login(callback);
  } else {
    deleteCacheForBoards(message, callback);
  }

};

exports.checkForLogin = function(message) {

  if (message.login) {

    if (feDebug) {
      var templateHandler = require('./engine/templateHandler');
      templateHandler.dropAlternativeTemplates();
      templateHandler.loadTemplates();
    }

  }

};

exports.queue = function(message) {

  if (verbose) {
    console.log('Queuing ' + JSON.stringify(message, null, 2));
  }

  if (master) {

    if (verbose) {
      console.log('Sending message to master node');
    }

    taskListener.sendToSocket(null, {
      type : 'rebuildMessage',
      message : message
    });

    return;
  }

  exports.checkForLogin(message);

  exports.deleteCache(message, function(error) {

    if (error) {
      console.log(error);
    }

  });

};