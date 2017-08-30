'use strict';

// handles the incoming data from another process that received commands from
// terminal

var fs = require('fs');
var net = require('net');
var settingsHandler = require('./settingsHandler');
var settings = settingsHandler.getGeneralSettings();
var socketLocation = settings.tempDirectory;
socketLocation += '/unix.socket';
var verbose = settings.verbose || settings.verboseMisc;
var kernel = require('./kernel');
var debug = kernel.debug();
var server;

function processTask(task) {

  switch (task.type) {
  case 'maintenance': {
    settingsHandler.changeMaintenanceMode(task.value);
    break;
  }

  case 'reloadFE': {
    kernel.broadCastTopDownMessage({
      reloadFE : true
    });
    break;
  }

  case 'shutdown': {
    server.close();

    kernel.broadCastTopDownMessage({
      shutdown : true
    });

    break;
  }

  default:
    console.log('Unknown task type ' + task.type);
  }

}

exports.handleSocket = function(socket) {

  var buffer = '';

  socket.on('data', function(data) {
    buffer += data;
  });

  socket.on('end', function() {

    try {
      processTask(JSON.parse(buffer));
    } catch (error) {
      console.log(error);
    }
  });

};

exports.start = function() {

  if (server) {
    server.close(function closed() {
      server = null;
      exports.start();
    });
    return;
  }

  fs.unlink(socketLocation, function removedFile(error) {

    if (error && error.code !== 'ENOENT') {

      if (verbose) {
        console.log(error);
      }

      kernel.broadCastTopDownMessage({
        socketStatus : true,
        status : error.message
      });

      return;

    }

    exports.status = null;

    // style exception, too simple
    server = net.createServer(function(socket) {

      exports.handleSocket(socket);

    }).listen(socketLocation);

    server.on('error', function handleError(error) {

      if (debug) {
        throw error;
      } else if (verbose) {
        console.log(error);
      }

      kernel.broadCastTopDownMessage({
        socketStatus : true,
        status : error.message
      });

    });
    // style exception, too simple

  });

};
