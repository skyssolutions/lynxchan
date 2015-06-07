'use strict';

// general operations for the json api
var boot = require('../boot');
var settings = boot.getGeneralSettings();
var debug = boot.debug();
var verbose = settings.verbose;
var accountOps = require('./accountOps');
var miscOps = require('./miscOps');
var fs = require('fs');
var crypto = require('crypto');
var captchaOps = require('./captchaOps');
var path = require('path');
var tempDir = settings.tempDirectory || '/tmp';
var uploadHandler = require('./uploadHandler');

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

// TODO change to use settings
var REQUEST_LIMIT_SIZE = 1e6 * 100;

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

function processFile(parsedData, res, finalArray, toRemove, callback) {
  var file = parsedData.parameters.files.shift();

  var matches = file.content.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);

  var location = uploadPath(tempDir, file.name);

  finalArray.push({
    title : file.name,
    mime : matches[1],
    pathInDisk : location
  });

  toRemove.push(location);

  fs.writeFile(location, new Buffer(matches[2], 'base64'), function wroteFile(
      error) {
    storeImages(parsedData, res, finalArray, toRemove, callback);
  });

}

function storeImages(parsedData, res, finalArray, toRemove, callback) {

  var hasFiles = parsedData.parameters && parsedData.parameters.files;

  if (hasFiles && parsedData.parameters.files.length) {
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

  req.on('data', function dataReceived(data) {
    body += data;

    if (body.length > REQUEST_LIMIT_SIZE) {

      exports.outputResponse(null, null, 'tooLong', res);

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