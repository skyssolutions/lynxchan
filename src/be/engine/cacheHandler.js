'use strict';

var zlib = require('zlib');
var path = require('path');
var fs = require('fs');
var cache = {};
var staticCache = {};
var buffer = {};
var lastTtl = new Date();
var next = {};
var current = {};
var gridFsHandler;
var settingsHandler = require('../settingsHandler');
var kernel = require('../kernel');
var taskListener = require('../taskListener');
var logger = require('../logger');
var miscOps;
var jitCacheOps;
var requestHandler;
var verbose;
var disable304;
var templateHandler;
var alternativeLanguages;
var defaultFePath;
var useCacheControl;
var staticExpiration;
var debug = kernel.feDebug();
var typeIndex = {
  boards : {},
  logs : {},
  multiboards : {}
};
var locks = {
  boards : {},
  logs : {},
  multiboards : {}
};

exports.typeIndex = typeIndex;
exports.locks = locks;

exports.loadSettings = function() {

  var settings = settingsHandler.getGeneralSettings();

  useCacheControl = settings.useCacheControl;
  staticExpiration = settings.staticExpiration;
  defaultFePath = settings.fePath;
  disable304 = settings.disable304;
  verbose = settings.verbose || settings.verboseCache;
  alternativeLanguages = settings.useAlternativeLanguages;

};

exports.loadDependencies = function() {
  miscOps = require('./miscOps');
  jitCacheOps = require('./jitCacheOps');
  requestHandler = require('./requestHandler');
  gridFsHandler = require('./gridFsHandler');
  templateHandler = require('./templateHandler').getTemplates;
};

exports.dropStaticCache = function() {
  staticCache = {};
};

exports.runTTL = function() {

  for ( var entry in current) {
    delete cache[entry];
  }

  current = next;
  next = {};

};

exports.clearBuffer = function() {

  for ( var key in buffer) {
    delete cache[key];
  }

  buffer = {};

};

// Section 1: Lock read {
exports.returnLock = function(task, lockKey, object, socket, selectedBoards) {

  var toReturn = object[lockKey] || false;

  if (!toReturn && !task.readOnly) {
    object[lockKey] = true;
  }

  taskListener.sendToSocket(socket, {
    locked : toReturn,
    selectedBoards : selectedBoards
  });

};

exports.receiveGetLock = function(task, socket) {

  var lockData = task.lockData;

  var boardObject;

  if (lockData.boardUri) {

    if (lockData.type === 'log') {

      boardObject = locks.logs[lockData.boardUri] || {};

      locks.logs[lockData.boardUri] = boardObject;

    } else {

      boardObject = locks.boards[lockData.boardUri] || {
        pages : {},
        threads : {}
      };

      locks.boards[lockData.boardUri] = boardObject;

    }
  }

  switch (lockData.type) {

  case 'multiboard': {
    return exports.returnLock(task, lockData.boards.join('_'),
        locks.multiboards, socket);
  }

  case 'thread': {
    return exports.returnLock(task, lockData.threadId, boardObject.threads,
        socket);
  }

  case 'log': {
    return exports.returnLock(task, lockData.date, boardObject, socket);
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

  taskListener.openSocket(function opened(error, socket) {

    if (error) {
      callback(error);
      return;
    }

    socket.onData = function receivedData(data) {
      callback(data.error, data.locked);
      taskListener.freeSocket(socket);
    };

    taskListener.sendToSocket(socket, {
      type : 'getLock',
      lockData : lockData,
      readOnly : readOnly
    });

  });

};

exports.deleteLock = function(task) {

  var lockData = task.lockData;

  switch (lockData.type) {

  case 'multiboard': {
    delete locks.multiboards[lockData.boards.join('_')];
    break;
  }

  case 'thread': {
    delete locks.boards[lockData.boardUri].threads[lockData.threadId];
    break;
  }

  case 'page': {
    delete locks.boards[lockData.boardUri].pages[lockData.page];
    break;
  }

  case 'log': {
    delete locks.logs[lockData.boardUri][lockData.date];
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

// Section 2: Cache deletion {
exports.getInfoToClear = function(task) {

  var boardIndex;

  if (task.boardUri) {

    if (task.cacheType === 'log') {
      boardIndex = typeIndex.logs[task.boardUri];
    } else {
      boardIndex = typeIndex.boards[task.boardUri];
    }

    if (!boardIndex) {
      return;
    }

  }

  switch (task.cacheType) {

  case 'thread':
  case 'last': {
    return {
      object : boardIndex.threads,
      indexKey : task.threadId
    };
  }

  case 'log': {
    return {
      object : boardIndex || typeIndex.logs,
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

exports.clearMultiBoardSelection = function(boardUri) {

  var toClear = typeIndex.multiboards[boardUri] || {};

  for ( var key in toClear) {

    if (!toClear.hasOwnProperty(key)) {
      continue;
    }

    var keyParts = key.split('_');

    for (var i = 0; i < keyParts.length; i++) {
      exports.clearArray(typeIndex.multiboards[keyParts[i]], key);
    }

  }

  delete typeIndex.multiboards[boardUri];

};

exports.clearMultiBoard = function(task) {

  if (task.boardUri) {
    exports.clearMultiBoardSelection(task.boardUri);
  } else {

    for ( var key in typeIndex.multiboards) {
      exports.clearMultiBoardSelection(key);
    }

  }

};

exports.performFullClear = function(object) {

  for ( var key in object) {

    if (!object.hasOwnProperty(key)) {
      continue;
    }

    if (Array.isArray(object[key])) {
      exports.clearArray(object, key);
    } else {
      exports.performFullClear(object[key]);
    }

  }

};

exports.checkForBuffer = function(toClear) {

  var entry = cache[toClear[0]];

  for ( var key in entry) {

    var sample = entry[key];

    var diff = (new Date() - new Date(sample.lastModified)) / 1000;

    return diff < 5;

  }

};

exports.clearArray = function(object, indexKey) {

  var toClear = object[indexKey];

  if (!toClear || !toClear.length) {
    return;
  }

  var moveToBuffer = exports.checkForBuffer(toClear);

  while (toClear.length) {

    var entry = toClear.pop();

    if (moveToBuffer) {
      buffer[entry] = true;
    } else {
      delete cache[entry];
    }

    delete current[entry];
    delete next[entry];
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

      if (Array.isArray(value)) {
        exports.clearArray(typeIndex.boards[boardUri], key);
      } else {
        exports.performFullClear(value);
      }

    }

    delete typeIndex.boards[boardUri];

  }

};

exports.runClear = function(task) {

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

exports.clear = function(task) {

  if (task.cacheType === 'log' && task.date) {

    for ( var key in typeIndex.logs) {
      task.boardUri = key;
      exports.runClear(task);
    }

    return;

  } else if (task.cacheType === 'boards') {
    return exports.clearAllBoards();
  } else if (task.cacheType === 'multiboard') {
    return exports.clearMultiBoard(task);
  }

  exports.runClear(task);

};
// } Section 2: Cache deletion

// Section 3: Master write file {
exports.pushIndex = function(indexToUse, key, dest) {

  var indexList = indexToUse[key] || [];
  indexToUse[key] = indexList;

  if (indexList.indexOf(dest) < 0) {
    indexList.push(dest);
  }

};

exports.pushMultiboardIndex = function(task, dest) {

  var key = task.meta.boards.join('_');

  for (var i = 0; i < task.meta.boards.length; i++) {

    var boardUri = task.meta.boards[i];

    var indexList = typeIndex.multiboards[boardUri] || {};
    typeIndex.multiboards[boardUri] = indexList;

    exports.pushIndex(typeIndex.multiboards[boardUri], key, dest);
  }

};

exports.placeIndex = function(task, dest) {

  var boardIndex;
  var indexList;

  if (task.meta.boardUri) {

    if (task.meta.type === 'log') {

      boardIndex = typeIndex.logs[task.meta.boardUri] || {};
      typeIndex.logs[task.meta.boardUri] = boardIndex;

    } else {

      boardIndex = typeIndex.boards[task.meta.boardUri] || {
        pages : {},
        threads : {}
      };
      typeIndex.boards[task.meta.boardUri] = boardIndex;

    }
  }

  switch (task.meta.type) {

  case 'multiboard': {
    return exports.pushMultiboardIndex(task, dest);
  }

  case 'catalog':
  case 'rules': {
    return exports.pushIndex(boardIndex, task.meta.type, dest);
  }

  case 'thread': {
    return exports.pushIndex(boardIndex.threads, task.meta.threadId, dest);
  }

  case 'log': {
    return exports.pushIndex(boardIndex, task.meta.date, dest);
  }

  case 'page': {
    return exports.pushIndex(boardIndex.pages, task.meta.page, dest);
  }

  case 'overboard':
  case 'frontPage': {
    return exports.pushIndex(typeIndex, task.meta.type, dest);
  }

  }

};

exports.receiveWriteData = function(task, socket) {

  task.data = Buffer.from(task.data, 'utf-8');

  zlib.gzip(task.data, function gotCompressedData(error, compressedData) {

    if (error) {

      taskListener.sendToSocket(socket, {
        error : error
      });

    } else {

      if (verbose) {
        console.log('Cached ' + task.dest);
      }

      var keyToUse = task.meta.referenceFile || task.dest;
      var referenceBlock = cache[keyToUse];

      if (!referenceBlock) {
        referenceBlock = {};
        cache[keyToUse] = referenceBlock;
        exports.placeIndex(task, keyToUse);
      }

      referenceBlock[task.dest] = {
        content : task.data,
        mime : task.mime,
        preferred : task.meta.preferred,
        length : task.data.length,
        compressed : false,
        compressable : true,
        path : task.dest,
        languages : task.meta.languages,
        lastModified : new Date().toUTCString()
      };

      referenceBlock[task.dest + '.gz'] = {
        mime : task.mime,
        path : task.dest + '.gz',
        preferred : task.meta.preferred,
        languages : task.meta.languages,
        lastModified : referenceBlock[task.dest].lastModified,
        compressed : true,
        compressable : true,
        content : compressedData,
        length : compressedData.length
      };

      taskListener.sendToSocket(socket, {});

    }

  });

};
// } Section 3: Master write file

exports.writeData = function(data, dest, mime, meta, callback) {

  taskListener.openSocket(function opened(error, socket) {
    if (error) {
      callback(error);
      return;
    }

    socket.onData = function receivedData(data) {
      callback(data.error);

      taskListener.freeSocket(socket);

    };

    taskListener.sendToSocket(socket, {
      type : 'cacheWrite',
      data : data,
      dest : dest,
      mime : mime,
      meta : meta
    });

  });

};

// Section 4: Master read file {
exports.languageIntersects = function(task, alternative) {

  if (alternative.preferred) {
    return true;
  }

  for (var i = 0; task.language && i < alternative.languages.length; i++) {

    var languageValue = alternative.languages[i];

    if (task.language.headerValues.indexOf(languageValue) >= 0) {
      return true;
    }

  }

};

exports.compressStaticFile = function(task, finalPath, file, callback) {

  zlib.gzip(file.content, function compressed(error, data) {

    if (error) {
      callback(error);
    } else {

      var compressedFile = {
        compressable : true,
        compressed : true,
        mime : file.mime,
        content : data,
        length : data.length,
        path : finalPath + '.gz',
        lastModified : file.lastModified,
        languages : file.languages
      };

      if (!debug) {
        staticCache[finalPath + '.gz'] = compressedFile;
      }

      callback(null, task.compressed ? compressedFile : file);

    }

  });

};

exports.processReadFile = function(finalPath, data, stats, task, callback) {

  var mime = logger.getMime(finalPath);
  var compressable = miscOps.isPlainText(mime);

  var file = {
    lastModified : stats.mtime.toUTCString(),
    mime : mime,
    path : finalPath,
    content : data,
    compressed : false,
    compressable : compressable || false,
    length : data.length,
    languages : task.language ? task.language.headerLanguages : null
  };

  if (!debug) {
    if (verbose) {
      console.log('Cached ' + task.file);
    }

    staticCache[finalPath] = file;
  }

  if (!compressable) {
    callback(null, file);
    return;
  }

  exports.compressStaticFile(task, finalPath, file, callback);

};

exports.getStaticFile = function(task, callback) {

  var finalPath = exports.getStaticFilePath(task);

  if (!finalPath) {
    callback('No path to get static file from');
    return;
  }

  var file = staticCache[finalPath];

  if (file && file.compressable && task.compressed) {
    file = staticCache[finalPath + '.gz'];
  }

  if (file) {
    callback(null, file);
    return;
  }

  var templated = templateHandler(task.language).templated[task.file
      .substring(9)];

  if (templated) {
    exports.processReadFile(finalPath, templated.data, templated.stats, task,
        callback);
    return;
  }

  fs.stat(finalPath, function gotStats(error, stats) {
    if (error) {
      callback(error);
    } else {

      // style exception, too simple
      fs.readFile(finalPath, function(error, data) {

        if (error) {
          callback(error);
        } else {
          exports.processReadFile(finalPath, data, stats, task, callback);
        }

      });
      // style exception, too simple

    }
  });

};

exports.getStaticFilePath = function(task) {

  var feToUse = task.language ? task.language.frontEnd : defaultFePath;

  var requiredRoot = path.normalize(feToUse + '/static');

  var finalPath = path.normalize(requiredRoot + task.file.substring(8));

  if (finalPath.indexOf(requiredRoot) < 0) {
    return null;
  }

  return finalPath;

};

exports.getAlternative = function(task, callback) {

  if (!task.isStatic) {
    callback(null, exports.pickAlternative(task, task.file));
  } else {
    exports.getStaticFile(task, callback);
  }

};

exports.pickAlternative = function(task, file) {

  var alternatives = cache[file];

  if (!alternatives) {
    return;
  }

  delete current[file];
  next[file] = true;

  var language;

  for ( var key in alternatives) {

    var alternative = alternatives[key];

    var differs = alternative.compressed !== task.compressed;
    if (differs && alternative.compressable) {
      continue;
    }

    if (!alternative.languages) {
      var vanilla = alternative;
    } else if (!language) {
      language = exports.languageIntersects(task, alternative) ? alternative
          : null;
    }

  }

  return language || vanilla;

};

exports.returnCacheToSend = function(task, socket, toSend) {

  if (verbose) {
    console.log('Read cache ' + task.file);
  }

  var parsedRange = requestHandler.readRangeHeader(task.range, toSend.length);

  taskListener.sendToSocket(socket, {
    code : parsedRange ? 206 : 200,
    range : parsedRange,
    compressed : toSend.compressed,
    mime : toSend.mime,
    path : toSend.path,
    languages : toSend.languages,
    length : toSend.length,
    lastModified : toSend.lastModified,
    compressable : toSend.compressable
  });

  taskListener.sendToSocket(socket, parsedRange ? toSend.content.slice(
      parsedRange.start, parsedRange.end + 1) : toSend.content);

};

exports.receiveOutputFile = function(task, socket) {

  exports.getAlternative(task, function gotAlternative(error, toSend) {

    if (error) {
      taskListener.sendToSocket(socket, {
        code : 500,
        error : error
      });
    } else if (!toSend) {
      taskListener.sendToSocket(socket, {
        code : 404
      });
    } else if (toSend.lastModified === task.lastSeen && !disable304) {
      taskListener.sendToSocket(socket, {
        code : 304
      });
    } else {
      exports.returnCacheToSend(task, socket, toSend);
    }

  });

};
// } Section 4: Master read file

// Section 5: Worker read file {
exports.addHeaderBoilerPlate = function(header, stats, isStatic) {

  if (stats.compressable) {
    header.push([ 'Vary', 'Accept-Encoding' ]);
  }

  header.push([ 'Accept-Ranges', 'bytes' ]);

  var expiration = new Date();

  var canCache = isStatic && staticExpiration;

  if (canCache) {
    expiration.setUTCMinutes(expiration.getUTCMinutes() + staticExpiration);
  }

  if (useCacheControl) {

    if (canCache) {
      header.push([ 'cache-control',
          'max-age=' + (expiration - new Date()) / 1000 ]);
    } else {
      header.push([ 'cache-control', 'no-cache' ]);
    }

  } else {
    header.push([ 'expires', expiration.toUTCString() ]);
  }

};

exports.getResponseHeader = function(stats, length, isStatic) {

  var header = [];

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

  exports.addHeaderBoilerPlate(header, stats, isStatic);

  return header;

};

exports.writeResponse = function(stats, data, res, isStatic, callback) {

  try {

    res.writeHead(stats.code, miscOps.getHeader(stats.mime, null, exports
        .getResponseHeader(stats, data.length, isStatic)));

    res.end(data);

    callback();

  } catch (error) {
    callback(error);
  }

};

exports.get304Headers = function(stats, isStatic) {

  var header = [];

  if (alternativeLanguages) {
    header.push([ 'Vary', 'Accept-Language' ]);
  }

  if (stats.compressable) {
    header.push([ 'Vary', 'Accept-Encoding' ]);
  }

  if (isStatic && staticExpiration) {
    var expiration = new Date();
    expiration.setUTCMinutes(expiration.getUTCMinutes() + staticExpiration);

    if (useCacheControl) {
      header.push([ 'cache-control',
          'max-age=' + (expiration - new Date()) / 1000 ]);
    } else {
      header.push([ 'expires', expiration.toUTCString() ]);
    }

  }

  return header;

};

exports.output304 = function(stats, res, isStatic, callback) {

  try {

    res.writeHead(304, miscOps.convertHeader(exports.get304Headers(stats,
        isStatic)));
    res.end();

    callback();

  } catch (error) {
    callback(error);
  }

};

exports.handleJit = function(pathName, req, res, callback) {

  jitCacheOps.checkCache(pathName, req.boards, function finished(error,
      notFound, usedJit) {

    if (error) {
      callback(error);
    } else if (notFound) {
      gridFsHandler.outputFile(pathName, req, res, callback);
    } else {
      exports.fetchCache(pathName, req, res, callback, null, usedJit);
    }

  });

};

exports.storeLocalCache = function(stats, content, pathName) {

  if (stats.code !== 200) {
    return;
  }

  var referenceBlock = cache[pathName];

  if (!referenceBlock) {
    referenceBlock = {};
    cache[pathName] = referenceBlock;
  }

  referenceBlock[stats.path] = {
    content : content,
    mime : stats.mime,
    length : content.length,
    compressed : stats.compressed,
    compressable : stats.compressable,
    languages : stats.languages,
    code : 200,
    lastModified : stats.lastModified
  };

};

exports.handleReceivedData = function(pathName, req, res, stats, content,
    isStatic, cb, usedJit) {

  switch (stats.code) {

  case 500: {
    cb(stats.error);
    break;
  }

  case 404: {

    if (isStatic || usedJit) {
      gridFsHandler.outputFile('/404.html', req, res, cb);
    } else {
      exports.handleJit(pathName, req, res, cb);
    }

    break;
  }

  case 304: {
    exports.output304(stats, res, isStatic, cb);
    break;
  }

  default: {
    exports.storeLocalCache(stats, content, pathName);
    exports.writeResponse(stats, content, res, isStatic, cb);
  }

  }

};

exports.fetchCache = function(pathName, req, res, callback, isStatic, usedJit) {

  var stats;

  taskListener.openSocket(function opened(error, socket) {

    if (error) {
      gridFsHandler.outputFile(pathName, req, res, callback);
      return;
    }

    socket.onData = function receivedData(data) {

      if (!stats) {
        stats = data;

        if (stats.code >= 300) {

          exports.handleReceivedData(pathName, req, res, stats, null, isStatic,
              callback, usedJit);

          taskListener.freeSocket(socket);

        }

      } else {

        exports.handleReceivedData(pathName, req, res, stats, data, isStatic,
            callback);

        taskListener.freeSocket(socket);

      }

    };

    taskListener.sendToSocket(socket, {
      type : 'cacheRead',
      range : req.headers.range,
      lastSeen : req.headers['if-modified-since'],
      file : pathName,
      compressed : req.compressed,
      language : req.language,
      isStatic : isStatic
    });

  });

};

exports.useLocalCache = function(localCache, req, res, isStatic, cb) {

  var notChanged = localCache.lastModified === req.headers['if-modified-since'];

  if (notChanged && !disable304) {
    exports.output304(localCache, res, isStatic, cb);
  } else {
    exports.writeResponse(localCache, localCache.content, res, isStatic, cb);
  }

};

exports.checkCacheValidity = function(localCache, pathName, req, res, callback,
    isStatic) {

  var stats;

  taskListener.openSocket(function opened(error, socket) {

    if (error) {
      exports.fetchCache(pathName, req, res, callback, isStatic);
      return;
    }

    socket.onData = function receivedData(data) {

      if (!stats) {
        stats = data;

        if (stats.code >= 300) {
          taskListener.freeSocket(socket);
        }

        if (stats.code >= 400) {
          exports.handleReceivedData(pathName, req, res, stats, data, isStatic,
              callback);
        } else if (stats.code >= 300) {
          exports.useLocalCache(localCache, req, res, isStatic, callback);
        }

      } else {

        exports.handleReceivedData(pathName, req, res, stats, data, isStatic,
            callback);

        taskListener.freeSocket(socket);

      }

    };

    taskListener.sendToSocket(socket, {
      type : 'cacheRead',
      range : req.headers.range,
      lastSeen : localCache.lastModified,
      file : pathName,
      compressed : req.compressed,
      language : req.language,
      isStatic : isStatic
    });

  });

};

exports.outputFile = function(pathName, req, res, cb, isStatic) {

  if (new Date() - lastTtl > 1000 * 60) {
    lastTtl = new Date();
    exports.runTTL();
  }

  var localCache = req.headers.range ? null : exports.pickAlternative({
    compressed : req.compressed,
    language : req.language
  }, pathName);

  if (!localCache) {
    exports.fetchCache(pathName, req, res, cb, isStatic);
  } else {
    exports.checkCacheValidity(localCache, pathName, req, res, cb, isStatic);
  }

};
// } Section 5: Worker read file
