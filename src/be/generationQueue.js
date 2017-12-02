'use strict';

// handles the page generation queue

var kernel = require('./kernel');
var debug = kernel.debug();
var feDebug = kernel.feDebug();
var degenerator;
var http = require('http');
var verbose;
var currentSlave = 0;
var MAX_TRIES = 4;
var master;
var port;

exports.reload = function() {
  degenerator = require('./engine/degenerator');
  var settings = require('./settingsHandler').getGeneralSettings();
  verbose = settings.verbose || settings.verboseQueue;
  master = settings.master;
  port = settings.port;
};

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

  var req = http.request({
    hostname : master,
    port : port,
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
  } else if (message.log) {
    degenerator.global.log(new Date(message.date), callback, true);
  } else if (message.overboard) {
    degenerator.global.overboard(callback, true);
  } else if (message.allBoards) {
    degenerator.board.boards(callback, true);
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

    if (debug) {

      try {
        kernel.reload();
      } catch (error) {
        throw error;
      }

    } else if (feDebug) {
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

    // TODO use a socket
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

  exports.checkForLogin(message);

  exports.deleteCache(message, function(error) {

    if (error) {

      if (debug) {
        throw error;
      } else {
        console.log(error);
      }

    }

  });

};