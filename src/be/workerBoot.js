'use strict';

// Continues the boot of the application on worker treads.
// Initializes the systems
// Controls connection listeners

var kernel = require('./kernel');
var settingsHandler = require('./settingsHandler');
var settings = settingsHandler.getGeneralSettings();
var verbose = settings.verbose;
var cluster = require('cluster');
var fs = require('fs');
var requestHandler;

// kernel variables
var serverBooted = false;
var debug = kernel.debug();

exports.reload = function() {

  settings = settingsHandler.getGeneralSettings();
  verbose = settings.verbose;
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
      passphrase : settings.sslPass
    };

    var server = require('https').createServer(options, function(req, res) {
      main(req, res);
    }).listen(443, settings.address);

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

function startTorPort() {

  var server = require('http').createServer(function(req, res) {
    req.isTor = true;

    main(req, res);

  }).listen(settings.torPort, settings.address);

  server.on('error', function handleError(error) {

    if (debug) {
      throw error;
    } else if (verbose) {
      console.log(error);
    }

  });

}

function startListening() {

  if (settings.ssl) {
    startSSL();
  }

  if (settings.torPort) {
    startTorPort();
  }

  var server = require('http').createServer(function(req, res) {
    main(req, res);

  }).listen(settings.port, settings.address);

  server.on('listening', function booted() {

    serverBooted = true;
    var message = 'Worker ' + cluster.worker.id;
    message += ' booted at ' + new Date().toUTCString();

    if (!debug) {
      requestHandler = require('./engine/requestHandler');
    }

    console.log(message);
  });

  server.on('error', function handleError(error) {

    console.log('Failed to listen to HTTP.');

    if (debug) {
      throw error;
    } else {
      console.log(error);
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