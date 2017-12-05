'use strict';

// handles the incoming data from another process that received commands from
// terminal

var fs = require('fs');
var net = require('net');
var settingsHandler = require('./settingsHandler');
var settings = settingsHandler.getGeneralSettings();
var socketLocation = settings.tempDirectory;
socketLocation += '/unix.socket';
var clusterPort;
var kernel = require('./kernel');
var noDaemon = kernel.noDaemon();
var debug = kernel.debug();
var server;
var tcpServer;
var master;
var slaves;
var verbose;
var cacheHandler;
var generationQueue;
var Socket = net.Socket;
var isMaster = require('cluster').isMaster;
var headerBuffer = Buffer.alloc(5);

exports.reload = function() {

  var settings = settingsHandler.getGeneralSettings();
  verbose = settings.verbose || settings.verboseMisc;
  cacheHandler = require('./engine/cacheHandler');
  master = settings.master;
  clusterPort = settings.clusterPort;
  slaves = settings.slaves;
  generationQueue = require('./generationQueue');

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

  case 'rebuildMessage': {
    generationQueue.queue(task.message);
    break;
  }

  case 'shutdown': {
    if (server) {
      server.close();
    }

    if (tcpServer) {
      tcpServer.close();
    }

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

exports.openSocket = function(callback) {

  var client = new Socket();

  client.on('error', callback);
  client.on('connect', function() {
    callback(null, client);
  });

  client.connect(master && !noDaemon ? {
    port : clusterPort,
    host : master
  } : socketLocation);

};

exports.sendToSocket = function(socket, data, callback) {

  if (!socket) {

    exports.openSocket(function opened(error, socket) {

      if (error) {

        if (callback) {
          callback(error);
        } else {
          console.log(error);
        }

      } else {

        if (callback) {
          socket.on('end', callback);
        }

        exports.sendToSocket(socket, data);

        socket.end();
      }

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

  if (tcpServer) {
    tcpServer.close(function closed() {
      tcpServer = null;
      exports.start();
    });
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

    if (clusterPort) {
      tcpServer = net.createServer(function clientConnected(client) {

        var remote = client.remoteAddress;

        var isSlave = slaves.indexOf(remote) > -1;

        var isMaster = master === remote;

        // Is up to the webserver to drop unwanted connections.
        if (remote !== '127.0.0.1' && ((master && !isMaster) || !isSlave)) {
          client.end();
          return;
        }

        exports.handleSocket(client, exports.processCacheTasks);
      }).listen(clusterPort, '0.0.0.0');
    }

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
