'use strict';

// general operations for the json api

var cluster = require('cluster');
var settings = require('../settingsHandler').getGeneralSettings();
var debug = require('../kernel').debug();
var verbose = settings.verbose;
var bans = require('../db').bans();
var fs = require('fs');
var crypto = require('crypto');
var path = require('path');
var tempDir = settings.tempDirectory;
var maxRequestSize = settings.maxRequestSizeB;
var maxFileSize = settings.maxFileSizeB;
var maxFiles = settings.maxFiles;
var accountOps;
var miscOps;
var modOps;
var uploadHandler;
var allowedMimes;
var videoMimes;
var lang;
var workerId = cluster.isMaster ? null : cluster.worker.id;
var reqCount = 0;

var FILE_EXT_RE = /(\.[_\-a-zA-Z0-9]{0,16}).*/;
// replace base64 characters with safe-for-filename characters
var b64Safe = {
  '/' : '_',
  '+' : '-'
};

exports.loadDependencies = function() {

  accountOps = require('./accountOps');
  miscOps = require('./miscOps');
  modOps = require('./modOps');
  uploadHandler = require('./uploadHandler');
  allowedMimes = uploadHandler.supportedMimes();
  videoMimes = uploadHandler.videoMimes();
  lang = require('./langOps').languagePack();

};

exports.getDomain = function(req) {
  return 'http://' + req.headers.host.substring(4);
};

exports.uploadPath = function(baseDir, filename) {
  var ext = path.extname(filename).replace(FILE_EXT_RE, '$1');
  var name = exports.randoString(18) + ext;
  return path.join(baseDir, name);
};

exports.randoString = function(size) {
  return exports.rando(size).toString('base64').replace(/[\/\+]/g, function(x) {
    return b64Safe[x];
  });
};

exports.rando = function(size) {
  try {
    return crypto.randomBytes(size);
  } catch (err) {
    return crypto.pseudoRandomBytes(size);
  }
};

exports.checkBlankParameters = function(object, parameters, res) {

  function failCheck(parameter, reason) {

    if (verbose) {
      console.log('Blank reason: ' + reason);
    }

    exports.outputResponse(null, parameter, 'blank', res);

    return true;
  }

  if (!object) {

    failCheck();

    return true;

  }

  for (var i = 0; i < parameters.length; i++) {
    var parameter = parameters[i];

    if (!object.hasOwnProperty(parameter)) {
      return failCheck(parameter, 'no parameter');

    }

    if (object[parameter] === null) {
      return failCheck(parameter, 'null');
    }

    if (object[parameter] === undefined) {
      return failCheck(parameter, 'undefined');
    }

    if (!object[parameter].toString().trim().length) {
      return failCheck(parameter, 'length');
    }
  }

  return false;

};

// Section 1: Request handling {

// Section 1.1: Upload handling {
exports.getFileData = function(matches, res, stats, file, location, content,
    exceptionalMimes, finalArray, callback) {

  var mime = matches[1];

  if (stats.size > maxFileSize) {
    exports.outputResponse(null, null, 'fileTooLarge', res);
  } else if (allowedMimes.indexOf(mime) === -1 && !exceptionalMimes) {
    exports.outputResponse(null, null, 'formatNotAllowed', res);
  } else {

    var toPush = {
      title : file.name,
      md5 : crypto.createHash('md5').update(content, 'base64').digest('hex'),
      size : stats.size,
      mime : mime,
      spoiler : file.spoiler,
      pathInDisk : location
    };

    var video = videoMimes.indexOf(toPush.mime) > -1;

    var measureFunction;

    if (toPush.mime.indexOf('image/') > -1) {
      measureFunction = uploadHandler.getImageBounds;
    } else if (video && settings.mediaThumb) {
      measureFunction = uploadHandler.getVideoBounds;
    }

    if (measureFunction) {

      measureFunction(toPush, function gotDimensions(error, width, height) {
        if (!error) {
          toPush.width = width;
          toPush.height = height;

          finalArray.push(toPush);
        }

        callback(error);

      });

    } else {
      finalArray.push(toPush);

      callback();
    }
  }

};

exports.processFile = function(file, res, finalArray, toRemove,
    exceptionalMimes, callback) {

  if (!file.name || !file.content) {
    exports.outputResponse(null, null, 'fileParseError', res);
    return;
  }

  file.content = file.content.toString();
  file.name = file.name.toString();

  var matches = file.content.match(/^data:([0-9A-Za-z-+\/]+);base64,(.+)$/);

  if (!matches) {
    exports.outputResponse(null, null, 'fileParseError', res);
    return;
  }

  var location = exports.uploadPath(tempDir, file.name);

  var content = matches[2];

  fs.writeFile(location, new Buffer(content, 'base64'), function wroteFile(
      error) {

    if (!error) {
      toRemove.push(location);

      // style exception, too simple
      fs.stat(location, function gotStats(error, stats) {
        if (error) {
          callback(error);
        } else {
          exports.getFileData(matches, res, stats, file, location, content,
              exceptionalMimes, finalArray, callback);
        }

      });
      // style exception, too simple

    } else {
      callback(error);
    }

  });

};

exports.storeImages = function(parsedData, res, finalArray, toRemove, callback,
    exceptionalMimes) {

  var hasFilesField = parsedData.parameters && parsedData.parameters.files;

  var tooManyFiles = finalArray.length === maxFiles;

  if (!tooManyFiles && hasFilesField && parsedData.parameters.files.length) {
    exports.processFile(parsedData.parameters.files.shift(), res, finalArray,
        toRemove, exceptionalMimes, function processedFile(error) {

          if (error) {

            if (error) {
              console.log(error);
            }

            if (debug) {
              throw error;
            }
          }

          exports.storeImages(parsedData, res, finalArray, toRemove, callback,
              exceptionalMimes);

        });

  } else {
    var parameters = parsedData.parameters || {};
    parameters.files = finalArray;

    var endingCb = function() {

      for (var j = 0; j < toRemove.length; j++) {
        uploadHandler.removeFromDisk(toRemove[j]);
      }

    };

    res.on('close', endingCb);

    res.on('finish', endingCb);

    if (verbose) {
      console.log('Api input: ' + JSON.stringify(parameters, null, 2));
    }

    callback(parsedData.auth, parameters, parsedData.captchaId,
        parsedData.bypassId);
  }

};
// } Section 1.1: Upload handling

exports.getAuthenticatedData = function(req, res, callback, optionalAuth,
    exceptionalMimes) {

  exports.getAnonJsonData(req, res, function gotData(auth, parameters,
      captchaId, bypassId) {

    accountOps.validate(auth, function validatedRequest(error, newAuth,
        userData) {

      if (error && !optionalAuth) {
        exports.outputError(error, res);
      } else {
        callback(newAuth, userData, parameters, captchaId, bypassId);
      }

    });

  }, exceptionalMimes);

};

// Section 1.2: Parsing data {
exports.handleWrittenData = function(res, path, exceptionalMimes, cb) {

  fs.readFile(path, function readData(error, data) {

    uploadHandler.removeFromDisk(path);

    if (error) {
      exports.outputError(error, res);
    } else {

      var parsedData;

      try {
        parsedData = JSON.parse(data);

      } catch (error) {
        exports.outputResponse(null, error.toString(), 'parseError', res);
      }

      if (parsedData) {
        exports.storeImages(parsedData, res, [], [], cb, exceptionalMimes);
      }

    }

  });

};

exports.getAnonJsonData = function(req, res, callback, exceptionalMimes) {

  // Use a temporary file to store incoming data and then read it back.

  // While it might add some overhead, RAM could be abused by a client sending
  // large amounts of data and throttling it's own speed.

  // The uniqueness of the temporary file is based on the combination of the
  // worker ID plus an incrementing number.
  var path = tempDir + '/API.REQ-' + workerId + '-' + reqCount++;

  // After a while (1M) we just reset the counter, there is no way to have this
  // many concurrent connections still sending us data.
  if (reqCount > 1000000) {
    reqCount = 0;
  }

  var stream = fs.createWriteStream(path);

  var ended = false;

  var totalLength = 0;

  req.on('data', function dataReceived(data) {

    if (ended) {
      return;
    }

    stream.write(data);

    totalLength += data.length;

    if (totalLength > maxRequestSize) {
      ended = true;

      // style exception, too simple
      stream.end(function closedStream() {
        uploadHandler.removeFromDisk(path);
      });

      req.connection.destroy();
      // style exception, too simple

    }
  });

  req.on('end', function dataEnded() {

    if (!ended) {

      ended = true;

      stream.end(function closedStream() {
        exports.handleWrittenData(res, path, exceptionalMimes, callback);
      });
    }

  });

};
// } Section 1.2: Parsing data

// } Section 1: Request handling

exports.outputError = function(error, res) {

  if (verbose) {
    console.log(error);
  }

  if (debug) {
    throw error;
  }

  exports.outputResponse(null, error.toString(), 'error', res);

};

exports.outputResponse = function(auth, data, status, res) {
  if (!res) {
    console.log('Null res object ' + status);
    return;
  }

  var output = {
    auth : auth || null,
    status : status,
    data : data || null
  };

  res.writeHead(200, miscOps.corsHeader('application/json'));

  if (verbose) {
    console.log('Api output: ' + JSON.stringify(output, null, 2));
  }

  res.end(JSON.stringify(output));
};

exports.checkForHashBan = function(parameters, req, res, callback) {

  modOps.hashBan.checkForHashBans(parameters, req, function gotBans(error,
      hashBans) {
    if (error) {
      callback(error);
    } else if (!hashBans) {
      callback();
    } else {
      exports.outputResponse(null, hashBans, 'hashBan', res);
    }
  });

};

exports.checkForBan = function(req, boardUri, res, callback, auth) {

  modOps.ipBan.versatile.checkForBan(req, boardUri, function gotBan(error, ban,
      bypassable) {

    if (bypassable && !req.bypassed) {
      exports.outputResponse(auth, null, 'bypassable', res);
    } else if (error) {
      callback(error);
    } else if (ban) {
      if (ban.range) {

        if (req.bypassed) {
          callback();
          return;
        }

        ban.range = ban.range.join('.');
      }

      exports.outputResponse(auth, {
        reason : ban.reason,
        appealled : ban.appeal ? true : false,
        range : ban.range,
        banId : ban._id,
        expiration : ban.expiration,
        board : ban.boardUri ? '/' + ban.boardUri + '/' : lang.miscAllBoards
            .toLowerCase()
      }, 'banned', res);
    } else {
      callback();
    }
  });

};