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
var server;
var tcpServer;
var master;
var captchaOps;
var slaves;
var accountOps;
var verbose;
var versatileOps;
var cacheHandler;
var wsHandler;
var generationQueue;
var Socket = net.Socket;
var isMaster = require('cluster').isMaster;
var headerBuffer = Buffer.alloc(5);
var pool = [];
var activeUnixSocketClients = [];
var activeTCPSocketClients = [];

exports.reload = function() {

  var settings = settingsHandler.getGeneralSettings();
  verbose = settings.verbose || settings.verboseMisc;
  wsHandler = require('./engine/webSocketHandler');
  cacheHandler = require('./engine/cacheHandler');
  master = settings.master;
  clusterPort = settings.clusterPort;
  slaves = settings.slaves;
  captchaOps = require('./engine/captchaOps');
  versatileOps = require('./engine/modOps').ipBan.versatile;
  generationQueue = require('./generationQueue');
  accountOps = require('./engine/accountOps');

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
    exports.processFloodTask(task, socket);
  }

};

exports.processFloodTask = function(task, socket) {

  switch (task.type) {

  case 'floodCheck': {
    versatileOps.masterFloodCheck(task, socket);
    break;
  }

  case 'checkAuthLimit': {
    accountOps.masterCheckAuthLimit(task.login, socket);
    break;
  }

  case 'recordFlood': {
    versatileOps.recordFlood(task);
    break;
  }

  case 'checkCaptchaLimit': {
    captchaOps.checkCaptchaLimit(task.ip, socket);
    break;
  }

  case 'createSession': {
    accountOps.masterCreateSession(task, socket);
    break;
  }

  case 'notifySockets': {
    wsHandler.notify(task);
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

exports.freeSocket = function(socket) {

  delete socket.handler;
  delete socket.onData;

  if (noDaemon) {
    socket.end();
  } else if (!socket.invalid) {
    pool.push(socket);
  }

};

exports.openSocket = function(callback) {

  if (pool.length) {

    var toRet = pool.pop();
    toRet.handler = callback;

    callback(null, toRet);
    return;
  }

  var client = new Socket();

  exports.handleSocket(client, function gotData(data) {

    if (client.onData) {
      client.onData(data);
    }

  });

  client.handler = callback;

  client.on('error', function(error) {

    if (client.handler) {
      client.handler(error);
      client.invalid = true;
      exports.freeSocket(client);

    } else {

      var index = pool.indexOf(client);

      if (index >= 0) {
        pool.splice(index, 1);
      }
    }

  });

  client.on('end', function() {

    if (client.handler) {
      client.handler('Lost connection');
      client.invalid = true;
      exports.freeSocket(client);
    } else {

      var index = pool.indexOf(client);

      if (index >= 0) {
        pool.splice(index, 1);
      }
    }

  });

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

        exports.sendToSocket(socket, data);

        exports.freeSocket(socket);

        if (callback) {
          callback();
        }
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

exports.bootSockets = function() {

  exports.status = null;

  server = net.createServer(function clientConnected(client) {

    activeUnixSocketClients.push(client);

    client.on('end', function() {

      var index = activeUnixSocketClients.indexOf(client);

      if (index >= 0) {
        activeUnixSocketClients.splice(index, 1);
      }

    });

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

      activeTCPSocketClients.push(client);

      client.on('end', function() {

        var index = activeTCPSocketClients.indexOf(client);

        if (index >= 0) {
          activeTCPSocketClients.splice(index, 1);
        }

      });

      exports.handleSocket(client, exports.processCacheTasks);
    }).listen(clusterPort, '0.0.0.0');
  }

  server.on('error', function handleError(error) {

    console.log(error);

    kernel.broadCastTopDownMessage({
      socketStatus : true,
      status : error.message
    });

  });

};

exports.start = function(firstBoot) {

  if (firstBoot) {

    process.on('exit', function(code) {

      if (exports.noRemoval) {
        return;
      }

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

    for (var i = 0; i < activeUnixSocketClients.length; i++) {
      activeUnixSocketClients[i].end();
    }

    return;
  }

  if (tcpServer) {

    tcpServer.close(function closed() {
      tcpServer = null;
      exports.start();
    });

    for (i = 0; i < activeTCPSocketClients.length; i++) {
      activeTCPSocketClients[i].end();
    }

    return;
  }

  exports.openSocket(function opened(error) {

    if (!error) {
      exports.noRemoval = true;

      var msg = 'There\'s already a daemon running. If there isn\'t,';
      msg += ' check what software has an open unix socket on ';
      msg += socketLocation;

      throw msg;
    }

    fs.unlink(socketLocation, function removedFile(error) {

      if (error && error.code !== 'ENOENT') {

        console.log(error);

        kernel.broadCastTopDownMessage({
          socketStatus : true,
          status : error.message
        });

        return;

      }

      exports.bootSockets();

    });

  });

};
