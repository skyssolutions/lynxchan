'use strict';

var fs = require('fs');
var WS = require('ws');
var wsPort;
var wssPort;
var settings;
var http2;
var verbose;
var ssl;
var socketRelation = {};

exports.loadSettings = function() {

  settings = require('../settingsHandler').getGeneralSettings();

  http2 = settings.useHttp2;
  wsPort = settings.wsPort;
  verbose = settings.verboseMisc || settings.verbose;
  wssPort = settings.wssPort;

};

exports.notify = function(task) {

  var array = socketRelation[task.boardUri + '-' + task.threadId];

  if (!array) {
    return;
  }

  for (var i = 0; i < array.length; i++) {
    array[i].send(task.postId);
  }

};

exports.registerConnection = function(conn) {

  var registered = false;

  conn.on('message', function(message) {

    if (registered) {
      return;
    }

    registered = message;

    var array = socketRelation[message] || [];
    socketRelation[message] = array;

    array.push(conn);

  });

  conn.on('close', function() {

    if (!registered) {
      return;
    }

    var array = socketRelation[registered];

    var index = array.indexOf(conn);

    if (index < 0) {
      return;
    }

    array.splice(index, 1);

    if (!array.length) {
      delete socketRelation[registered];
    }

  });

};

exports.primeSocket = function(socket) {

  socket.on('connection', function(conn) {

    exports.registerConnection(conn);

  });

};

exports.init = function() {

  if (settings.master) {
    return;
  }

  if (wsPort) {

    exports.primeSocket(new WS.Server({
      port : wsPort,
      host : settings.address
    }));

  }

  if (!wssPort) {
    return;
  }

  var options = {
    key : fs.readFileSync(__dirname + '/../ssl.key'),
    cert : fs.readFileSync(__dirname + '/../ssl.cert'),
    passphrase : settings.sslPass,
    allowHTTP1 : true
  };

  try {
    options.ca = fs.readFileSync(__dirname + '/../ssl.chain');
  } catch (error) {
    if (verbose) {
      console.log('SSL chain not available.');
    }
  }

  var server = require(http2 ? 'http2' : 'https')[http2 ? 'createSecureServer'
      : 'createServer'](options).listen(wssPort, settings.address);

  exports.primeSocket(new WS.Server({
    server : server
  }));

};