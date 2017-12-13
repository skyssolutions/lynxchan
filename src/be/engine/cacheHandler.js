'use strict';

var zlib = require('zlib');
var path = require('path');
var fs = require('fs');
var cache = {};
var staticCache = {};
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
var alternativeLanguages;
var defaultFePath;
var debug = kernel.debug() || kernel.feDebug();
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
};

exports.dropStaticCache = function() {
  staticCache = {};
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
    boardObject = locks.boards[lockData.boardUri] || {
      pages : {},
      threads : {}
    };

    locks.boards[lockData.boardUri] = boardObject;
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

// Section 2: Cache deletion {
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

      if (Array.isArray(value)) {
        exports.clearArray(typeIndex.boards[boardUri], key);
      } else {
        exports.performFullClear(value);
      }

    }

    delete typeIndex.boards[boardUri];

  }

};

exports.clear = function(task) {

  if (task.cacheType === 'boards') {
    return exports.clearAllBoards();
  } else if (task.cacheType === 'multiboard') {
    return exports.clearMultiBoard(task);
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
// } Section 2: Cache deletion

// Section 3: Master write file {
exports.pushIndex = function(indexToUse, key, dest) {

  var indexList = indexToUse[key] || [];
  indexToUse[key] = indexList;

  indexList.push(dest);

};

exports.pushMultiboardIndex = function(task) {

  var key = task.meta.boards.join('_');

  for (var i = 0; i < task.meta.boards.length; i++) {

    var boardUri = task.meta.boards[i];

    var indexList = typeIndex.multiboards[boardUri] || {};
    typeIndex.multiboards[boardUri] = indexList;

    exports.pushIndex(typeIndex.multiboards[boardUri], key, task.dest);
  }

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

  case 'multiboard': {
    return exports.pushMultiboardIndex(task);
  }

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
        exports.placeIndex(task);
      }

      referenceBlock[task.dest] = {
        content : task.data,
        mime : task.mime,
        length : task.data.length,
        compressed : false,
        compressable : true,
        languages : task.meta.languages,
        lastModified : new Date().toUTCString()
      };

      referenceBlock[task.dest + '.gz'] = {
        mime : task.mime,
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

exports.getStaticFile = function(task, finalPath, callback) {

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

  fs.stat(finalPath, function gotStats(error, stats) {
    if (error) {
      callback(error);
    } else {

      // style exception, too simple
      fs.readFile(finalPath, function(error, data) {

        if (error) {
          callback(error);
        } else {

          var mime = logger.getMime(finalPath);
          var compressable = miscOps.isPlainText(mime);

          file = {
            lastModified : stats.mtime.toUTCString(),
            mime : mime,
            content : data,
            compressed : false,
            compressable : compressable,
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
    callback(null, exports.pickAlternative(task, cache[task.file]));
  } else {
    exports.getStaticFile(task, exports.getStaticFilePath(task), callback);
  }

};

exports.pickAlternative = function(task, alternatives) {

  if (!alternatives) {
    return;
  }

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
exports.addHeaderBoilerPlate = function(header, stats) {

  if (stats.compressable) {
    header.push([ 'Vary', 'Accept-Encoding' ]);
  }

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

  exports.addHeaderBoilerPlate(header, stats);

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

exports.output304 = function(stats, res, callback) {

  try {

    var header = [];

    if (alternativeLanguages) {
      header.push([ 'Vary', 'Accept-Language' ]);
    }

    if (stats.compressable) {
      header.push([ 'Vary', 'Accept-Encoding' ]);
    }

    res.writeHead(304, header);
    res.end();

    callback();

  } catch (error) {
    callback(error);
  }

};

exports.handleJit = function(pathName, req, res, callback) {

  jitCacheOps.checkCache(pathName, req.boards, function finished(error,
      notFound) {

    if (error) {
      callback(error);
    } else if (notFound) {
      gridFsHandler.outputFile(pathName, req, res, callback);
    } else {
      req.alreadyCached = true;
      exports.outputFile(pathName, req, res, callback);
    }

  });

};

exports.handleReceivedData = function(pathName, req, res, stats, content,
    isStatic, cb) {

  switch (stats.code) {

  case 500: {
    cb(stats.error);
    break;
  }

  case 404: {

    if (isStatic || req.alreadyCached) {
      gridFsHandler.outputFile('/404.html', req, res, cb);
    } else {
      exports.handleJit(pathName, req, res, cb);
    }

    break;
  }

  case 304: {
    exports.output304(stats, res, cb);
    break;
  }

  default: {
    exports.writeResponse(stats, content, res, cb);
  }

  }

};

exports.outputFile = function(pathName, req, res, callback, isStatic) {

  var stats;

  taskListener.openSocket(function opened(error, socket) {

    if (error) {
      callback(error);
      return;
    }

    socket.onData = function receivedData(data) {

      if (!stats) {
        stats = data;

        if (stats.code >= 300) {

          exports.handleReceivedData(pathName, req, res, stats, null, isStatic,
              callback);

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
// } Section 5: Worker read file
