'use strict';

// handles the incoming data from another process that received commands from
// terminal

var fs = require('fs');
var net = require('net');
var settingsHandler = require('./settingsHandler');
var socketLocation = settingsHandler.getGeneralSettings().tempDirectory;
socketLocation += '/unix.socket';

function processTask(task) {

  switch (task.type) {
  case 'maintenance':
    settingsHandler.changeMaintenanceMode(task.value);
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

    // style exception, too simple
    var server = net.createServer(function(socket) {

      exports.handleSocket(socket);

    }).listen(socketLocation);
    // style exception, too simple

  });

};
