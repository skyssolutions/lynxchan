'use strict';

// Continues the boot of the application on worker treads.
// Initializes the systems
// Controls connection listeners

var logger = require('./logger');
var boot = require('./boot');
var settingsHandler = require('./settingsHandler');
var verbose = settingsHandler.getGeneralSettings().verbose;
var cluster = require('cluster');
var fs = require('fs');
var requestHandler;

// paths
var fePath;

// boot variables
var booted = false;
var debug = boot.debug();

exports.reload = function() {

  verbose = settingsHandler.getGeneralSettings().verbose;
  requestHandler = require('./engine/requestHandler');
};

// functions
function main(req, res) {

  if (!booted) {
    req.connection.destroy();
    return;
  }

  if (debug) {
    try {
      boot.reload();
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

function startListening() {

  try {

    if (settingsHandler.getGeneralSettings().ssl) {

      try {

        var options = {
          key : fs.readFileSync(__dirname + '/server.key'),
          cert : fs.readFileSync(__dirname + '/server.pem')
        };

        require('https').createServer(options, function(req, res) {
          main(req, res);
        }).listen(443, settingsHandler.getGeneralSettings().address);

      } catch (error) {
        console.log(error);
      }

    }

    require('http').createServer(function(req, res) {
      main(req, res);

    }).listen(settingsHandler.getGeneralSettings().port,
        settingsHandler.getGeneralSettings().address);

    booted = true;

    var message = 'Server worker ' + cluster.worker.id;
    message += ' booted at ' + logger.timestamp();

    if (!debug) {
      requestHandler = require('./engine/requestHandler');
    }

    console.log(message);
  } catch (error) {
    if (verbose) {
      console.log(error);
    }

    if (debug) {
      throw error;
    }
  }

}

exports.boot = function() {
  require('./db').init(function dbBooted(error) {

    if (error) {
      console.log(error);
    } else {
      boot.startEngine();

      startListening();
    }

  });

};