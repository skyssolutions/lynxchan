'use strict';

// Continues the boot of the application on worker treads.
// Initializes the systems
// Controls connection listeners

var logger = require('./logger');
var kernel = require('./kernel');
var settingsHandler = require('./settingsHandler');
var verbose = settingsHandler.getGeneralSettings().verbose;
var cluster = require('cluster');
var fs = require('fs');
var requestHandler;

// kernel variables
var serverBooted = false;
var debug = kernel.debug();

exports.reload = function() {

  verbose = settingsHandler.getGeneralSettings().verbose;
  requestHandler = require('./engine/requestHandler');
};

// functions
function main(req, res) {

  if (!serverBooted) {
    req.connection.destroy();
    return;
  }

  if (debug) {
    try {
      kernel.reload();
    } catch (error) {
      console.log(error);
      req.connection.destroy();
      return;
    }

    require('./engine/requestHandler').handle(req, res);

  } else {
    requestHandler.handle(req, res);
  }

}

function startSSL() {

  try {

    var options = {
      key : fs.readFileSync(__dirname + '/ssl.key'),
      cert : fs.readFileSync(__dirname + '/ssl.cert'),
      passphrase : settingsHandler.getGeneralSettings().sslPass
    };

    var server = require('https').createServer(options, function(req, res) {
      main(req, res);
    }).listen(443, settingsHandler.getGeneralSettings().address);

    server.on('error', function handle(error) {

      if (verbose) {
        console.log(error);
      }

      if (debug) {
        throw error;
      }
    });
  } catch (error) {

    if (verbose) {
      console.log(error);
    }

    if (debug) {
      throw error;
    }

  }

}

function startListening() {

  if (settingsHandler.getGeneralSettings().ssl) {
    startSSL();
  }

  var server = require('http').createServer(function(req, res) {
    main(req, res);

  }).listen(settingsHandler.getGeneralSettings().port,
      settingsHandler.getGeneralSettings().address);

  server.on('listening', function booted() {

    serverBooted = true;
    var message = 'Server worker ' + cluster.worker.id;
    message += ' booted at ' + logger.timestamp();

    if (!debug) {
      requestHandler = require('./engine/requestHandler');
    }

    console.log(message);
  });

  server.on('error', function handleError(error) {

    console.log('Failed to listen to HTTP.');
    console.log('Enable verbose or debug mode to print the error.');

    if (verbose) {
      console.log(error);
    }

    if (debug) {
      throw error;
    }

  });

}

exports.boot = function() {
  require('./db').init(function dbBooted(error) {

    if (error) {
      console.log(error);
    } else {
      kernel.startEngine();

      startListening();
    }

  });

};