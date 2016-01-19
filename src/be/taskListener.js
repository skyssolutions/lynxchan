'use strict';

// handles the incoming data from another process that received commands from
// terminal

var fs = require('fs');
var net = require('net');
var settingsHandler = require('./settingsHandler');
var settings = settingsHandler.getGeneralSettings();
var socketLocation = settings.tempDirectory;
socketLocation += '/unix.socket';
var verbose = settings.verbose;
var kernel = require('./kernel');
var debug = kernel.debug();

function processTask(task) {

  switch (task.type) {
  case 'maintenance':
    settingsHandler.changeMaintenanceMode(task.value);
    break;

  case 'reloadFE':
    kernel.broadCastTopDownMessage({
      reloadFE : true
    });
    break;
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

  fs.unlink(socketLocation, function removedFile(error) {

    if (error && error.code !== 'ENOENT' && verbose) {
      console.log(error);
    }

    // style exception, too simple
    var server = net.createServer(function(socket) {

      exports.handleSocket(socket);

    }).listen(socketLocation);

    server.on('error', function handleError(error) {
      if (verbose) {
        console.log(error);
      }

      if (debug) {
        throw error;
      }

    });
    // style exception, too simple

  });

};
