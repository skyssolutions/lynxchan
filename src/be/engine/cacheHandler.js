'use strict';

var zlib = require('zlib');
var cache = {};
var net = require('net');
var socketLocation;
var gridFsHandler;
var settingsHandler = require('../settingsHandler');
var taskListener = require('../taskListener');
var miscOps;
var jitCacheOps;
var requestHandler;
var disable304;
var alternativeLanguages;
var typeIndex = {
  boards : {},
  logs : {}
};
var locks = {
  boards : {},
  logs : {}
};

exports.loadSettings = function() {

  var settings = settingsHandler.getGeneralSettings();

  disable304 = settings.disable304;
  alternativeLanguages = settings.useAlternativeLanguages;
  socketLocation = settings.tempDirectory;
  socketLocation += '/unix.socket';

};

exports.loadDependencies = function() {
  miscOps = require('./miscOps');
  jitCacheOps = require('./jitCacheOps');
  requestHandler = require('./requestHandler');
  gridFsHandler = require('./gridFsHandler');
};

// Section 1: Lock read {
exports.returnLock = function(task, lockKey, object, socket) {

  var toReturn = object[lockKey] || false;

  if (!toReturn && !task.readOnly) {
    object[lockKey] = true;
  }

  taskListener.sendToSocket(socket, {
    locked : toReturn
  });

  socket.end();

};

exports.receiveGetLock = function(task, socket) {

  var lockData = task.lockData;

  var boardObject;

  if (lockData.boardUri) {
    boardObject = locks.boards[lockData.boardUri] || {
      pages : {},
      threads : {}
    };

    locks.boards[lockData.boardUri] = boardObject;
  }

  switch (lockData.type) {

  case 'thread': {
    return exports.returnLock(task, lockData.threadId, boardObject.threads,
        socket);
  }

  case 'log': {
    return exports.returnLock(task, lockData.date, locks.logs, socket);
  }

  case 'rules':
  case 'catalog': {
    return exports.returnLock(task, lockData.type, boardObject, socket);
  }

  case 'page': {
    return exports.returnLock(task, lockData.page, boardObject.pages, socket);
  }

  case 'overboard':
  case 'index': {
    return exports.returnLock(task, lockData.type, locks, socket);
  }

  }

};
// } Section 1: Lock read

exports.getLock = function(lockData, readOnly, callback) {

  var client = new net.Socket();

  client.on('error', callback);

  client.connect(socketLocation, function() {

    taskListener.handleSocket(client, function receivedData(data) {
      callback(null, data.locked);
    });

    taskListener.sendToSocket(client, {
      type : 'getLock',
      lockData : lockData,
      readOnly : readOnly
    });

  });

};

exports.deleteLock = function(task) {

  var lockData = task.lockData;

  switch (lockData.type) {

  case 'thread': {
    delete locks.boards[lockData.boardUri].threads[lockData.threadId];
    break;
  }

  case 'page': {
    delete locks.boards[lockData.boardUri].pages[lockData.page];
    break;
  }

  case 'log': {
    delete locks.logs[lockData.date];
    break;
  }

  case 'rules':
  case 'catalog': {
    delete locks.boards[lockData.boardUri][lockData.type];
    break;
  }

  case 'overboard':
  case 'index': {
    delete locks[lockData.type];
    break;
  }

  }

};

exports.getInfoToClear = function(task) {

  var boardIndex;

  if (task.boardUri) {
    boardIndex = typeIndex.boards[task.boardUri];

    if (!boardIndex) {
      return;
    }
  }

  switch (task.cacheType) {

  case 'thread': {
    return {
      object : boardIndex.threads,
      indexKey : task.threadId
    };
  }

  case 'log': {
    return {
      object : typeIndex.logs,
      indexKey : task.date
    };
  }

  case 'rules':
  case 'catalog': {
    return {
      object : boardIndex,
      indexKey : task.cacheType
    };
  }

  case 'page': {
    return {
      object : boardIndex.pages,
      indexKey : task.page
    };
  }

  case 'overboard':
  case 'frontPage': {
    return {
      object : typeIndex,
      indexKey : task.cacheType
    };
  }

  }

};

exports.performFullClear = function(object) {

  for ( var key in object) {

    if (!object.hasOwnProperty(key)) {
      continue;
    }

    exports.clearArray(object, key);

  }

};

exports.clearArray = function(object, indexKey) {

  var toClear = object[indexKey];

  while (toClear && toClear.length) {
    delete cache[toClear.pop()];
  }

  delete object[indexKey];

};

exports.clearAllBoards = function() {

  for ( var boardUri in typeIndex.boards) {

    if (!typeIndex.boards.hasOwnProperty(boardUri)) {
      continue;
    }

    for ( var key in typeIndex.boards[boardUri]) {

      if (!typeIndex.boards[boardUri].hasOwnProperty(key)) {
        continue;
      }

      var value = typeIndex.boards[boardUri][key];

      if (Object.prototype.toString.call(value) === '[object Array]') {
        exports.clearArray(typeIndex.boards[boardUri], key);
      } else {
        exports.performFullClear(value);
      }

    }

    delete typeIndex[boardUri];

  }

};

exports.clear = function(task) {

  if (task.cacheType === 'boards') {
    return exports.clearAllBoards();
  }

  var clearInfo = exports.getInfoToClear(task);

  if (!clearInfo) {
    return;
  }

  if (!clearInfo.indexKey) {
    exports.performFullClear(clearInfo.object);
  } else {
    exports.clearArray(clearInfo.object, clearInfo.indexKey);
  }

};

// Section 2: Master write file {
exports.pushIndex = function(indexToUse, key, dest) {

  var indexList = indexToUse[key] || [];
  indexToUse[key] = indexList;

  indexList.push(dest);

};

exports.placeIndex = function(task) {

  var boardIndex;
  var indexList;

  if (task.meta.boardUri) {
    boardIndex = typeIndex.boards[task.meta.boardUri] || {
      pages : {},
      threads : {}
    };
    typeIndex.boards[task.meta.boardUri] = boardIndex;
  }

  switch (task.meta.type) {

  case 'catalog':
  case 'rules': {
    return exports.pushIndex(boardIndex, task.meta.type, task.dest);
  }

  case 'thread': {
    return exports.pushIndex(boardIndex.threads, task.meta.threadId, task.dest);
  }

  case 'log': {
    return exports.pushIndex(typeIndex.logs, task.meta.date, task.dest);
  }

  case 'page': {
    return exports.pushIndex(boardIndex.pages, task.meta.page, task.dest);
  }

  case 'overboard':
  case 'frontPage': {
    return exports.pushIndex(typeIndex, task.meta.type, task.dest);
  }

  }

};

exports.receiveWriteData = function(task, socket) {

  task.data = Buffer.from(task.data, 'utf-8');

  var keyToUse = task.meta.referenceFile || task.dest;
  var referenceBlock = cache[keyToUse];

  if (!referenceBlock) {
    exports.placeIndex(task);
    referenceBlock = {};
    cache[keyToUse] = referenceBlock;
  } else {
    delete referenceBlock[task.dest];
    delete referenceBlock[task.dest + '.gz'];
  }

  var regularEntry = {
    content : task.data,
    mime : task.mime,
    length : task.data.length,
    compressed : false,
    languages : task.meta.languages,
    lastModified : new Date().toUTCString()
  };

  var compressedEntry = {
    mime : task.mime,
    languages : task.meta.languages,
    lastModified : regularEntry.lastModified,
    compressed : true
  };

  zlib.gzip(task.data, function gotCompressedData(error, compressedData) {
    if (error) {

      taskListener.sendToSocket(socket, {
        error : error
      });

    } else {

      referenceBlock[task.dest] = regularEntry;
      referenceBlock[task.dest + '.gz'] = compressedEntry;

      compressedEntry.length = compressedData.length;
      compressedEntry.content = compressedData;

      taskListener.sendToSocket(socket, {});

    }

    socket.end();

  });

};
// } Section 2: Master write file

exports.writeData = function(data, dest, mime, meta, callback) {

  var client = new net.Socket();

  client.on('error', callback);

  client.connect(socketLocation, function() {

    taskListener.handleSocket(client, function receivedData(data) {
      callback(data.error);
    });

    taskListener.sendToSocket(client, {
      type : 'cacheWrite',
      data : data,
      dest : dest,
      mime : mime,
      meta : meta
    });

  });

};

// Section 3: Master read file {
exports.languageIntersects = function(task, alternative) {

  for (var i = 0; task.languages && i < alternative.languages.length; i++) {

    var languageValue = alternative.languages[i];

    if (task.languages.indexOf(languageValue) >= 0) {
      return true;
    }

  }

};

exports.getAlternative = function(task, alternatives) {

  var vanilla;
  var language;

  for ( var key in alternatives) {

    var alternative = alternatives[key];

    if (alternative.compressed !== task.compressed) {
      continue;
    }

    if (!alternative.languages) {
      vanilla = alternative;
    } else if (!language) {
      language = exports.languageIntersects(task, alternative) ? alternative
          : null;
    }

  }

  return vanilla || language;

};

exports.receiveOutputFile = function(task, socket) {

  var alternatives = cache[task.file];

  if (!alternatives) {
    taskListener.sendToSocket(socket, {
      code : 404
    });

    socket.end();
    return;
  }

  var toSend = exports.getAlternative(task, alternatives);

  if (!toSend) {
    taskListener.sendToSocket(socket, {
      code : 404
    });

    socket.end();
  } else if (toSend.lastModified === task.lastSeen) {
    taskListener.sendToSocket(socket, {
      code : 304
    });

    socket.end();
  } else {

    var parsedRange = requestHandler.readRangeHeader(task.range, toSend.length);

    taskListener.sendToSocket(socket, {
      code : parsedRange ? 206 : 200,
      range : parsedRange,
      compressed : toSend.compressed,
      mime : toSend.mime,
      languages : toSend.languages,
      length : toSend.length,
      lastModified : toSend.lastModified
    });

    taskListener.sendToSocket(socket, parsedRange ? toSend.content.slice(
        parsedRange.start, parsedRange.end + 1) : toSend.content);

    socket.end();

  }

};
// } Section 3: Master read file

// Section 4: Worker read file {
exports.addHeaderBoilerPlate = function(header) {

  header.push([ 'Vary', 'Accept-Encoding' ]);
  header.push([ 'Accept-Ranges', 'bytes' ]);
  header.push([ 'expires', new Date().toUTCString() ]);

};

exports.getResponseHeader = function(stats, length) {

  var header = miscOps.getHeader(stats.mime);

  if (stats.range) {
    var rangeString = 'bytes ' + stats.range.start + '-' + stats.range.end;
    rangeString += '/' + stats.length;

    header.push([ 'Content-Range', rangeString ]);
  }

  header.push([ 'last-modified', stats.lastModified ]);

  if (stats.compressed) {
    header.push([ 'Content-Encoding', 'gzip' ]);
  }

  if (alternativeLanguages) {
    header.push([ 'Vary', 'Accept-Language' ]);
  }

  if (stats.languages) {
    header.push([ 'Content-Language', stats.languages.join(', ') ]);
  }

  header.push([ 'Content-Length', length ]);

  exports.addHeaderBoilerPlate(header);

  return header;

};

exports.writeResponse = function(stats, data, res, callback) {

  try {

    res.writeHead(stats.code, exports.getResponseHeader(stats, data.length));

    res.end(data);

    callback();

  } catch (error) {
    callback(error);
  }

};

exports.output304 = function(res, callback) {

  try {

    var header = [];

    if (alternativeLanguages) {
      header.push([ 'Vary', 'Accept-Language' ]);
    }

    header.push([ 'Vary', 'Accept-Encoding' ]);

    res.writeHead(304, header);
    res.end();

    callback();

  } catch (error) {
    callback(error);
  }

};

exports.handleJit = function(pathName, req, res, callback) {

  jitCacheOps.checkCache(pathName, function finished(error, notFound) {

    if (error) {
      callback(error);
    } else if (notFound) {
      gridFsHandler.outputFile(pathName, req, res, callback);
    } else {
      exports.outputFile(pathName, req, res, callback);
    }

  });

};

exports.handleReceivedData = function(pathName, req, res, stats, content, cb) {

  switch (stats.code) {

  case 404: {
    exports.handleJit(pathName, req, res, cb);
    break;
  }

  case 304: {
    exports.output304(res, cb);
    break;
  }

  default: {
    exports.writeResponse(stats, content, res, cb);
  }

  }

};

exports.outputFile = function(pathName, req, res, callback) {

  var stats;
  var content;

  var client = new net.Socket();

  client.on('end', function ended() {

    exports.handleReceivedData(pathName, req, res, stats || {
      code : 404
    }, content, callback);

  });

  client.on('error', callback);

  client.connect(socketLocation, function() {

    taskListener.handleSocket(client, function receivedData(data) {

      if (!stats) {
        stats = data;
      } else {
        content = data;
      }

    });

    taskListener.sendToSocket(client, {
      type : 'cacheRead',
      range : req.headers.range,
      lastSeen : req.headers['if-modified-since'],
      file : pathName,
      compressed : req.compressed,
      languages : req.language ? req.language.headerValues : null
    });

  });

};
// } Section 4: Worker read file
