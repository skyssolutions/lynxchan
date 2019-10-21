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
var http2 = settings.useHttp2;
var stoppedServers = 0;

// kernel variables
var serverBooted = false;

exports.reload = function() {

  settings = settingsHandler.getGeneralSettings();
  verbose = settings.verbose || settings.verboseMisc;
  http2 = settings.useHttp2;
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

  requestHandler.handle(req, res);

}

function startSSL() {

  try {

    var options = {
      key : fs.readFileSync(__dirname + '/ssl.key'),
      cert : fs.readFileSync(__dirname + '/ssl.cert'),
      passphrase : settings.sslPass,
      allowHTTP1 : true
    };

    try {
      options.ca = fs.readFileSync(__dirname + '/ssl.chain');
    } catch (error) {
      if (verbose) {
        console.log('SSL chain not available.');
      }
    }

    var server = require(http2 ? 'http2' : 'https')[http2 ? 'createSecureServer'
        : 'createServer'](options, function(req, res) {

      if (req.headers && !req.headers.host) {
        req.headers.host = req.headers[':authority'];
      }

      main(req, res);
    }).listen(443, settings.address);

    servers.push(server);

    server.on('error', function handle(error) {

      if (verbose) {
        console.log(error);
      }

    });
  } catch (error) {

    console.log('Failed to listen to HTTPS.');

    console.log(error);

  }

}

function startTorPort() {

  var server = require('http').createServer(function(req, res) {
    req.isTor = true;
    req.isOnion = true;

    main(req, res);

  }).listen(settings.torPort, settings.address);

  servers.push(server);

  server.on('error', function handleError(error) {

    console.log('Failed to listen on the TOR port.');

    console.log(error);

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

    if (forcedSsl) {

      var parsedData = url.parse('http://' + req.headers.host);

      res.writeHead(302, {
        'Location' : 'https://' + parsedData.hostname + req.url
      });

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

    requestHandler = require('./engine/requestHandler');

    console.log(message);
  });

  server.on('error', function handleError(error) {

    console.log('Failed to listen to HTTP.');

    console.log(error);

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