'use strict';

// Continues the boot of the application on worker treads.
// Initializes the systems
// Controls connection listeners

var kernel = require('./kernel');
var settingsHandler = require('./settingsHandler');
var settings = settingsHandler.getGeneralSettings();
var forcedSsl = settings.ssl > 1;
var verbose = settings.verbose || settings.verboseMisc;
var cluster = require('cluster');
var fs = require('fs');
var url = require('url');
var requestHandler;
var servers = [];
var stoppedServers = 0;

// kernel variables
var serverBooted = false;
var debug = kernel.debug();

exports.reload = function() {

  settings = settingsHandler.getGeneralSettings();
  verbose = settings.verbose || settings.verboseMisc;
  requestHandler = require('./engine/requestHandler');
};

// functions
var serverStoppedCallback = function(callback) {

  stoppedServers++;

  if (stoppedServers === servers.length) {
    callback();
  }

};

exports.stopServers = function(callback) {

  for (var i = 0; i < servers.length; i++) {
    servers[i].close(serverStoppedCallback(callback));
  }

};

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

    try {
      options.ca = fs.readFileSync(__dirname + '/ssl.chain');
    } catch (error) {
      if (verbose) {
        console.log('SSL chain not available.');
      }
    }

    var server = require('https').createServer(options, function(req, res) {
      main(req, res);
    }).listen(443, settings.address);

    servers.push(server);

    server.on('error', function handle(error) {

      if (debug) {
        throw error;
      } else if (verbose) {
        console.log(error);
      }

    });
  } catch (error) {

    console.log('Failed to listen to HTTPS.');

    if (debug) {
      throw error;
    } else {
      console.log(error);
    }

  }

}

function startTorPort() {

  var server = require('http').createServer(function(req, res) {
    req.isTor = true;

    main(req, res);

  }).listen(settings.torPort, settings.address);

  servers.push(server);

  server.on('error', function handleError(error) {

    console.log('Failed to listen on the TOR port.');

    if (debug) {
      throw error;
    } else {
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

  var server = require('http').createServer(
      function(req, res) {

        if (forcedSsl) {

          var parsedData = url.parse('http://' + req.headers.host);

          var header = [ [ 'Location',
              'https://' + parsedData.hostname + req.url ] ];

          res.writeHead(302, header);

          res.end();

          return;
        }

        main(req, res);
      }).listen(settings.port, settings.address);

  servers.push(server);

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