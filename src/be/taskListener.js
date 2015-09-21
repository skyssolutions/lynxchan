'use strict';

var net = require('net');
var settingsHandler = require('./settingsHandler');
var tcpPort = settingsHandler.getGeneralSettings().tcpPort;

function processTask(task) {

  switch (task.type) {
  case 'maintenance':
    settingsHandler.changeMaintenanceMode(task.value);
    break;
  }

}

exports.start = function() {

  var server = net.createServer(function(socket) {

    var buffer = '';

    socket.on('data', function(data) {
      buffer += data;
    });

    socket.on('end', function() {

      processTask(JSON.parse(buffer));

    });

  }).listen(tcpPort, '127.0.0.1');

};
