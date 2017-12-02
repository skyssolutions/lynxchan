'use strict';

// handles the incoming data from another process that received commands from
// terminal

var fs = require('fs');
var net = require('net');
var settingsHandler = require('./settingsHandler');
var settings = settingsHandler.getGeneralSettings();
var socketLocation = settings.tempDirectory;
socketLocation += '/unix.socket';
var kernel = require('./kernel');
var debug = kernel.debug();
var server;
var verbose;
var cacheHandler;
var Socket = net.Socket;
var headerBuffer = Buffer.alloc(5);

exports.reload = function() {

  var settings = settingsHandler.getGeneralSettings();
  verbose = settings.verbose || settings.verboseMisc;
  cacheHandler = require('./engine/cacheHandler');

};

exports.processCacheTasks = function(task, socket) {

  switch (task.type) {

  case 'deleteLock': {
    cacheHandler.deleteLock(task);
    break;
  }

  case 'getLock': {
    cacheHandler.receiveGetLock(task, socket);
    break;
  }

  case 'cacheWrite': {
    cacheHandler.receiveWriteData(task, socket);
    break;
  }

  case 'cacheRead': {
    cacheHandler.receiveOutputFile(task, socket);
    break;
  }

  case 'cacheClear': {
    cacheHandler.clear(task);
    break;
  }

  default:
    exports.processTask(task, socket);
  }

};

exports.processTask = function(task, socket) {

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

};

exports.handleSocket = function(socket, callback) {

  var buffer;

  socket.on('data', function(data) {

    if (!buffer || !buffer.length) {
      buffer = data;
    } else {
      buffer = Buffer.concat([ buffer, data ], buffer.length + data.length);
    }

    while (true) {

      if (buffer.length < 4) {
        return;
      }

      var payloadLength = buffer.readInt32BE(0);

      if (buffer.length < payloadLength) {
        return;
      }

      var payload = buffer.slice(5, payloadLength);

      if (!buffer[4]) {
        payload = JSON.parse(payload.toString('utf8'));
      }

      callback(payload, socket);

      buffer = buffer.slice(payloadLength);

    }

  });

};

exports.sendToSocket = function(socket, data, callback) {

  if (typeof socket === 'string') {

    var client = new Socket();

    if (callback) {
      client.on('end', callback);
      client.on('error', callback);
    }

    client.connect(socket, function() {
      exports.sendToSocket(client, data);

      client.end();
    });

    return;

  }

  var binary = Buffer.isBuffer(data);

  if (!binary) {
    data = Buffer.from(JSON.stringify(data), 'utf-8');
  }

  headerBuffer.writeInt32BE(data.length + 5);
  headerBuffer[4] = binary ? 1 : 0;

  socket.write(headerBuffer);
  socket.write(data);

};

exports.start = function(firstBoot) {

  if (firstBoot) {

    process.on('exit', function(code) {

      try {
        fs.unlinkSync(socketLocation);
      } catch (error) {
        if (verbose) {
          console.log(error);
        }
      }

    });

    process.on('SIGINT', function() {
      console.log();

      process.exit(2);

    });

    process.on('SIGTERM', function(code) {
      process.exit(15);
    });

  }

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
    server = net.createServer(function clientConnected(client) {
      exports.handleSocket(client, exports.processCacheTasks);
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
