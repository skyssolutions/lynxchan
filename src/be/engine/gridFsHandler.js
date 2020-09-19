'use strict';

// handles every gridfs operation.

var zlib = require('zlib');
var fs = require('fs');
var http = require('http');
var exec = require('child_process').exec;
var db = require('../db');
var logger = require('../logger');
var redirects = db.redirects();
var files = db.files();
var chunks = db.chunks();
var bucket = new (require('mongodb')).GridFSBucket(db.conn());
var disable304;
var verbose;
var alternativeLanguages;
var miscOps;
var diskMedia;
var useCacheControl;
var requestHandler;
var masterNode;
var port;

exports.permanentTypes = [ 'media', 'graph', 'banner' ];

exports.loadSettings = function() {

  var settings = require('../settingsHandler').getGeneralSettings();

  useCacheControl = settings.useCacheControl;
  port = settings.port;
  masterNode = settings.master;
  disable304 = settings.disable304;
  verbose = settings.verbose || settings.verboseGridfs;
  alternativeLanguages = settings.useAlternativeLanguages;
  diskMedia = settings.diskMedia;

};

exports.loadDependencies = function() {
  miscOps = require('./miscOps');
  requestHandler = require('./requestHandler');
};

exports.removeDuplicates = function(uploadStream, callback) {

  files.aggregate([ {
    $match : {
      _id : {
        $ne : uploadStream.id
      },
      $or : [ {
        filename : uploadStream.filename
      }, {
        'metadata.referenceFile' : uploadStream.filename
      } ]
    }
  }, {
    $group : {
      _id : '$onDisk',
      ids : {
        $push : '$_id'
      }
    }
  } ]).toArray(function gotArray(error, results) {

    if (error || !results.length) {
      callback();
    } else {
      exports.separateToBeRemoved(results, callback);
    }
  });
};

// Section 1: Writing data {
exports.compressData = function(data, dest, mime, meta, callback) {

  zlib.gzip(data, function gotCompressedData(error, data) {
    if (error) {
      callback(error);
    } else {

      meta.referenceFile = meta.referenceFile || dest;

      exports.writeData(data, dest + '.gz', mime, meta, callback, true);
    }

  });

};

exports.writeData = function(data, dest, mime, meta, callback, compressed) {

  if (typeof (data) === 'string') {

    data = Buffer.from(data, 'utf-8');
  }

  if (!compressed) {

    meta.lastModified = new Date();

    if (miscOps.isPlainText(mime)) {
      meta.compressed = true;
    }
  }

  if (verbose) {
    console.log('Writing data on gridfs under \'' + dest + '\'');
  }

  var uploadStream = bucket.openUploadStream(dest, {
    contentType : mime,
    metadata : meta,
    disableMD5 : true
  });

  uploadStream.once('error', callback);

  uploadStream.once('finish', function finished() {

    // style exception, too simple
    exports.removeDuplicates(uploadStream, function removedDuplicates(error) {

      if (error) {
        callback(error);
      } else {

        if (!compressed && meta.compressed) {
          exports.compressData(data, dest, mime, meta, callback);
        } else {
          callback();
        }

      }

    });
    // style exception, too simple

  });

  uploadStream.write(data);

  uploadStream.end();

};
// } Section 1: Writing data

// Section 2: Writing file {
exports.sendFileToMaster = function(newDoc, path, callback, attempts, error) {

  attempts = attempts || 0;

  if (attempts >= 10) {
    return callback(error);
  }

  var cmd = 'curl -F "files=@' + path + ';filename=' + newDoc._id + '" http://';
  cmd += masterNode + ':' + port + '/storeFile.js';

  exec(cmd, function(error, data) {

    if (error) {
      return exports
          .sendFileToMaster(newDoc, path, callback, ++attempts, error);
    } else {
      callback(null, newDoc);
    }

  });

};

exports.copyFileToLocation = function(path, newDoc, callback) {

  var idString = newDoc._id.toString();
  var destDir = __dirname + '/../media/';
  destDir += idString.substring(idString.length - 3);
  var newPath = destDir + '/' + idString;

  fs.mkdir(destDir, function(error) {

    if (error && error.code !== 'EEXIST') {
      return callback(error);
    }

    // style exception, too simple
    fs.copyFile(path, newPath, function(error) {
      callback(error, newDoc);
    });
    // style exception, too simple

  });

};

exports.writeFileToDisk = function(dest, path, fileInfo, callback, size) {

  var newDoc = {
    filename : dest,
    onDisk : true,
    contentType : fileInfo.contentType,
    metadata : fileInfo.metadata,
    length : size
  };

  files.insertOne(newDoc, function(error) {

    if (error) {
      return callback(error);
    }

    newDoc.id = newDoc._id;

    if (masterNode) {
      return exports.sendFileToMaster(newDoc, path, callback);
    }

    exports.copyFileToLocation(path, newDoc, callback);

  });

};

exports.getDiskFileStats = function(dest, path, fileInfo, callback) {

  fs.stat(path, function(error, info) {

    if (error) {
      return callback(error);
    }

    exports.writeFileToDisk(dest, path, fileInfo, callback, info.size);

  });

};

exports.writeFileToGridFs = function(dest, path, fileInfo, callback) {

  var uploadStream = bucket.openUploadStream(dest, fileInfo);
  var readStream = fs.createReadStream(path);

  readStream.on('error', callback);
  uploadStream.on('error', callback);

  uploadStream.once('finish', function() {
    callback(null, uploadStream);
  });

  readStream.pipe(uploadStream);

};

exports.writeFile = function(path, dest, mime, meta, callback) {

  meta.lastModified = new Date();

  if (verbose) {
    var message = 'Writing ' + mime + ' file on gridfs under \'';
    message += dest + '\'';
    console.log(message);
  }

  var fileInfo = {
    contentType : mime,
    metadata : meta
  };

  var writeCallback = function(error, newDoc) {

    if (error) {
      callback(error);
    } else {

      exports.removeDuplicates(newDoc, function(error) {
        callback(error, newDoc.id);
      });
    }

  };

  if (meta.type === 'media' && diskMedia) {
    exports.getDiskFileStats(dest, path, fileInfo, writeCallback);
  } else {

    fileInfo.disableMD5 = true;

    exports.writeFileToGridFs(dest, path, fileInfo, writeCallback);
  }

};
// } Section 2: Writing file

// Section 3: Removal {
exports.removeGridFsFiles = function(onDb, callback) {

  if (!onDb || !onDb.ids.length) {
    return callback();
  }

  chunks.removeMany({
    'files_id' : {
      $in : onDb.ids
    }
  }, function removedChunks(error) {

    if (error) {
      callback();
    } else {

      // style exception, too simple
      files.removeMany({
        _id : {
          $in : onDb.ids
        }
      }, function() {
        callback();
      });
      // style exception, too simple

    }

  });

};

exports.removeFilesFromMaster = function(toRemove, callback, attempts, error) {

  attempts = attempts || 0;

  if (attempts >= 10) {
    return callback(error);
  }

  var cmd = 'curl http://';
  cmd += masterNode + ':' + port + '/removeFiles.js?ids=' + toRemove.join(',');

  exec(cmd, function(error, data) {

    if (error) {
      return exports.sendFileToMaster(toRemove, callback, ++attempts, error);
    } else {
      callback();
    }

  });

};

exports.removeFilesFromDisk = function(toRemove, callback, index) {

  index = index || 0;

  if (index >= toRemove.length) {
    return callback();
  }

  var idString = toRemove[index].toString();

  var path = __dirname + '/../media/' + idString.substring(idString.length - 3);
  path += '/' + idString;

  fs.unlink(path, function(error) {

    if (error && error.code !== 'ENOENT') {
      callback(error);
    } else {
      exports.removeFilesFromDisk(toRemove, callback, ++index);
    }

  });

};

exports.removeDiskFiles = function(onDisk, onDb, callback) {

  if (!onDisk || !onDisk.ids.length) {
    return exports.removeGridFsFiles(onDb, callback);
  }

  var toRemove = onDisk.ids.splice(0, 10);

  var removalCallback = function(error) {

    if (error) {
      return exports.removeGridFsFiles(onDb, callback);
    }

    files.removeMany({
      _id : {
        $in : toRemove
      }
    }, function(error) {

      if (error) {
        exports.removeGridFsFiles(onDb, callback);
      } else {
        exports.removeDiskFiles(onDisk, onDb, callback);
      }

    });

  };

  if (masterNode) {
    exports.removeFilesFromMaster(toRemove, removalCallback);
  } else {
    exports.removeFilesFromDisk(toRemove, removalCallback);
  }

};

exports.separateToBeRemoved = function(results, callback) {

  var onDisk;
  var onDb;

  for (var i = 0; i < results.length; i++) {

    var result = results[i];

    if (result._id) {

      if (!onDisk) {
        onDisk = result;
      } else {
        onDisk.ids = onDisk.ids.concat(result.ids);
      }

    } else {

      if (!onDb) {
        onDb = result;
      } else {
        onDb.ids = onDb.ids.concat(result.ids);
      }

    }

  }

  exports.removeDiskFiles(onDisk, onDb, callback);

};

exports.removeFiles = function(name, callback) {

  if (typeof (name) === 'string') {
    name = [ name ];
  }

  files.aggregate([ {
    $match : {
      filename : {
        $in : name
      }
    }
  }, {
    $group : {
      _id : '$onDisk',
      ids : {
        $push : '$_id'
      }
    }
  } ]).toArray(function gotFiles(error, results) {

    if (error || !results.length) {
      callback();
    } else {
      exports.separateToBeRemoved(results, callback);
    }

  });

};
// } Section 3: Removal

// Section 4: Reading file {
exports.setExpiration = function(header, stats) {
  var expiration = new Date();

  var permanent = exports.permanentTypes.indexOf(stats.metadata.type) > -1;

  if (permanent) {
    expiration.setFullYear(expiration.getFullYear() + 1);
  }

  if (!useCacheControl) {
    header.push([ 'expires', expiration.toUTCString() ]);
  } else {

    if (permanent) {
      header.push([ 'cache-control',
          'max-age=' + (expiration - new Date()) / 1000 ]);
    } else {
      header.push([ 'cache-control', 'no-cache' ]);
    }

  }

};

exports.getHeader = function(stats, req) {

  var header = [];
  var lastM = stats.metadata.lastModified || stats.uploadDate;
  header.push([ 'last-modified', lastM.toUTCString() ]);

  exports.setExpiration(header, stats);

  return header;
};

exports.streamFile = function(stream, range, stats, req, res, header, retries,
    callback) {

  var wrote = false;

  stream.on('data', function(chunk) {

    if (!wrote) {
      wrote = true;

      if (stats.metadata.compressed) {

        if (req.compressed) {
          header.push([ 'Content-Encoding', 'gzip' ]);
        }

        header.push([ 'Vary', 'Accept-Encoding' ]);
      }

      if (alternativeLanguages) {
        header.push([ 'Vary', 'Accept-Language' ]);
      }

      if (stats.metadata.languages) {

        header
            .push([ 'Content-Language', stats.metadata.languages.join(', ') ]);
      }

      res.writeHead(range ? 206 : (stats.metadata.status || 200), miscOps
          .getHeader(stats.contentType, null, header));
    }

    res.write(chunk);

  });

  stream.once('end', function() {
    res.end();
    callback();
  });

  stream.once('error', function(error) {

    retries = retries || 0;

    if (wrote || retries >= 9) {
      callback(error);
    } else {

      // We failed before writing anything, wait 10ms and try again
      setTimeout(function() {
        exports.prepareStream(stats, req, callback, res, ++retries);
      }, 10);

    }

  });

};

exports.handleRangeSettings = function(options, range, stats, header) {

  options.start = range.start;
  options.end = range.end + 1;

  header.push([ 'Content-Range',
      'bytes ' + range.start + '-' + range.end + '/' + stats.length ]);

  return range.end - range.start + 1;

};

exports.prepareStream = function(stats, req, callback, res, retries) {

  var header = exports.getHeader(stats, req);

  var range = requestHandler.readRangeHeader(req.headers.range, stats.length);
  header.push([ 'Accept-Ranges', 'bytes' ]);

  var options = {
    revision : 0
  };

  var length;

  if (range) {
    length = exports.handleRangeSettings(options, range, stats, header);
  } else {
    length = stats.length;
  }

  header.push([ 'Content-Length', length ]);

  if (stats.onDisk) {

    var idString = stats._id.toString();

    var diskPath = __dirname + '/../media/';
    diskPath += idString.substring(idString.length - 3) + '/' + idString;
  }

  exports.streamFile(stats.onDisk ? fs.createReadStream(diskPath, options)
      : bucket.openDownloadStreamByName(stats.filename, options), range, stats,
      req, res, header, retries, callback);

};

exports.output304 = function(fileStats, res) {

  var header = [];

  if (alternativeLanguages) {
    header.push([ 'Vary', 'Accept-Language' ]);
  }

  exports.setExpiration(header, fileStats);

  if (fileStats.metadata.compressed) {
    header.push([ 'Vary', 'Accept-Encoding' ]);
  }

  res.writeHead(304, miscOps.convertHeader(header));
  res.end();

};

exports.shouldOutput304 = function(req, stats) {

  stats.metadata = stats.metadata || {};

  var lastModified = stats.metadata.lastModified || stats.uploadDate;

  var mTimeMatches = req.headers['if-modified-since'] === lastModified
      .toUTCString();

  return mTimeMatches && !disable304 && !stats.metadata.status;

};

exports.takeLanguageFile = function(file, req, currentPick) {

  var isCompressed = file.filename.indexOf('.gz') === file.filename.length - 3;

  var takesCompressed = !!req.compressed;
  var toRet = takesCompressed === isCompressed;

  return toRet || (!currentPick && !isCompressed);

};

exports.handlePickedFile = function(finalPick, req, res, callback) {

  if (!finalPick) {
    exports.outputFile('/404.html', req, res, callback);
  } else if (exports.shouldOutput304(req, finalPick)) {
    exports.output304(finalPick, res);
  } else {
    if (verbose) {
      console.log('Streaming \'' + finalPick.filename + '\'');
    }
    exports.prepareStream(finalPick, req, callback, res);
  }

};

exports.pickFile = function(fileRequested, req, res, possibleFiles, callback) {

  var vanilla;
  var compressed;
  var language;

  for (var i = 0; i < possibleFiles.length; i++) {

    var file = possibleFiles[i];

    if (fileRequested === file.filename) {
      vanilla = file;
    } else if (!file.metadata.languages && req.compressed) {
      compressed = file;
    } else if (exports.takeLanguageFile(file, req, language)) {
      language = file;
    }
  }

  exports.handlePickedFile(language || compressed || vanilla, req, res,
      callback);

};

exports.checkRedirects = function(file, req, res, callback) {

  redirects.findOne({
    origin : file
  }, function gotRedirect(error, redirect) {

    if (error) {
      callback(error);
    } else if (redirect) {

      res.writeHead(302, miscOps.getHeader(null, null, [ [ 'Location',
          redirect.destination ] ]));
      res.end();

    } else {
      exports.outputFile('/404.html', req, res, callback);
    }

  });

};

exports.outputFile = function(file, req, res, callback) {

  if (verbose) {
    console.log('Outputting \'' + file + '\' from gridfs');
  }

  var languageCondition = req.language ? {
    $or : [ {
      'metadata.languages' : {
        $exists : false
      }
    }, {
      'metadata.languages' : {
        $in : req.language.headerValues
      }
    } ]
  } : {
    'metadata.languages' : {
      $exists : false
    }
  };

  files.find({
    $or : [ {
      $and : [ {
        'metadata.referenceFile' : file
      }, languageCondition ]
    }, {
      filename : file
    } ]
  }).toArray(function gotFiles(error, possibleFiles) {

    if (error) {
      callback(error);
    } else if (!possibleFiles.length) {

      if (file === '/404.html') {
        callback({
          code : 'ENOENT'
        });
      } else {
        exports.checkRedirects(file, req, res, callback);
      }

    } else {
      exports.pickFile(file, req, res, possibleFiles, callback);
    }
  });

};
// } Section 4: Reading file
