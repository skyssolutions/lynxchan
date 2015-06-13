'use strict';

// general operations for the json api
var boot = require('../boot');
var settings = boot.getGeneralSettings();
var debug = boot.debug();
var verbose = settings.verbose;
var accountOps = require('./accountOps');
var miscOps = require('./miscOps');
var bans = require('../db').bans();
var fs = require('fs');
var crypto = require('crypto');
var captchaOps = require('./captchaOps');
var path = require('path');
var tempDir = boot.tempDir();
var uploadHandler = require('./uploadHandler');
var maxRequestSize = boot.maxRequestSize();
var maxFileSize = boot.maxFileSize();
var acceptedMimes = uploadHandler.supportedMimes();
var maxFiles = settings.maxFiles || 3;

var FILE_EXT_RE = /(\.[_\-a-zA-Z0-9]{0,16}).*/;
// replace base64 characters with safe-for-filename characters
var b64Safe = {
  '/' : '_',
  '+' : '-'
};

function uploadPath(baseDir, filename) {
  var ext = path.extname(filename).replace(FILE_EXT_RE, '$1');
  var name = randoString(18) + ext;
  return path.join(baseDir, name);
}

function randoString(size) {
  return rando(size).toString('base64').replace(/[\/\+]/g, function(x) {
    return b64Safe[x];
  });
}

function rando(size) {
  try {
    return crypto.randomBytes(size);
  } catch (err) {
    return crypto.pseudoRandomBytes(size);
  }
}

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

function getImageBounds(toPush, parsedData, res, finalArray, toRemove, cb) {

  uploadHandler.getImageBounds(toPush.pathInDisk, function gotBounds(error,
      width, height) {
    if (!error) {
      toPush.width = width;
      toPush.height = height;

      finalArray.push(toPush);
    }

    storeImages(parsedData, res, finalArray, toRemove, cb);
  });

}

function processFile(parsedData, res, finalArray, toRemove, callback) {
  var file = parsedData.parameters.files.shift();

  var matches = file.content.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);

  var location = uploadPath(tempDir, file.name);

  var content = matches[2];

  fs.writeFile(location, new Buffer(content, 'base64'), function wroteFile(
      error) {

    if (!error) {
      toRemove.push(location);

      // style exception, too simple

      fs.stat(location, function gotStats(error, stats) {
        if (error) {
          storeImages(parsedData, res, finalArray, toRemove, callback);
        } else {

          var mime = matches[1];

          if (stats.size > maxFileSize || acceptedMimes.indexOf(mime) === -1) {
            storeImages(parsedData, res, finalArray, toRemove, callback);
          } else {

            var toPush = {
              title : file.name,
              size : stats.size,
              mime : mime,
              pathInDisk : location
            };

            if (toPush.mime.indexOf('image/') > -1) {

              getImageBounds(toPush, parsedData, res, finalArray, toRemove,
                  callback);

            } else {

              finalArray.push(toPush);

              storeImages(parsedData, res, finalArray, toRemove, callback);
            }
          }
        }

      });

      // style exception, too simple
    } else {
      storeImages(parsedData, res, finalArray, toRemove, callback);
    }

  });

}

function storeImages(parsedData, res, finalArray, toRemove, callback) {

  var hasFilesField = parsedData.parameters && parsedData.parameters.files;

  var tooManyFiles = finalArray.length === maxFiles;

  if (!tooManyFiles && hasFilesField && parsedData.parameters.files.length) {
    processFile(parsedData, res, finalArray, toRemove, callback);

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
      console.log('Api input: ' + JSON.stringify(parameters));
    }

    callback(parsedData.auth, parameters);
  }

}

exports.getAuthenticatedData = function(req, res, callback, checkCaptcha) {

  exports.getAnonJsonData(req, res, function gotData(auth, parameters) {

    accountOps.validate(auth, function validatedRequest(error, newAuth,
        userData) {

      if (error) {
        exports.outputError(error, res);
      } else {
        callback(newAuth, userData, parameters);
      }

    });

  }, checkCaptcha);

};

exports.getAnonJsonData = function(req, res, callback, checkCaptcha) {

  var body = '';

  var totalLength = 0;

  req.on('data', function dataReceived(data) {
    body += data;

    totalLength += data.length;

    if (totalLength > maxRequestSize) {
      req.connection.destroy();
    }
  });

  req.on('end', function dataEnded() {

    try {
      var parsedData = JSON.parse(body);

      if (checkCaptcha) {

        // style exception, too simple
        captchaOps.attemptCaptcha(parsedData.captchaId,
            parsedData.parameters.captcha, function attemptedCaptcha(error) {
              if (error) {
                exports.outputError(error, res);
              } else {
                storeImages(parsedData, res, [], [], callback);
              }
            });
        // style exception, too simple
      } else {
        storeImages(parsedData, res, [], [], callback);
      }

    } catch (error) {
      exports.outputResponse(null, error.toString(), 'parseError', res);
    }

  });

};

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
    console.log('Api output: ' + JSON.stringify(output));
  }

  res.end(JSON.stringify(output));
};

exports.checkForBan = function(req, boardUri, res, callback) {

  var ip = req.connection.remoteAddress;

  bans.findOne({
    ip : ip,
    expiration : {
      $gt : new Date()
    },
    $or : [ {
      boardUri : boardUri
    }, {
      boardUri : {
        $exists : false
      }
    } ]
  }, function gotBan(error, ban) {
    if (error) {
      callback(error);
    } else if (ban) {
      exports.outputResponse(null, {
        reason : ban.reason,
        expiration : ban.expiration,
        board : ban.boardUri ? '/' + ban.boardUri + '/' : 'all boards'
      }, 'banned', res);
    } else {
      callback();
    }
  });

};