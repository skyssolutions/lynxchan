'use strict';

// general operations for the form api
var boot = require('../boot');
var settings = boot.getGeneralSettings();
var bans = require('../db').bans();
var accountOps = require('./accountOps');
var uploadHandler = require('./uploadHandler');
var fs = require('fs');
var crypto = require('crypto');
var debug = boot.debug();
var verbose = settings.verbose;
var modOps = require('./modOps');
var multiParty = require('multiparty');
var miscOps = require('./miscOps');
var jsdom = require('jsdom').jsdom;
var domManipulator = require('./domManipulator');
var uploadHandler = require('./uploadHandler');
var lang = require('./langOps').languagePack();
var uploadDir = boot.tempDir();
var maxRequestSize = boot.maxRequestSize();
var maxFileSize = boot.maxFileSize();
var acceptedMimes = uploadHandler.supportedMimes();
var maxFiles = boot.maxFiles();

exports.getCookies = function(req) {
  var parsedCookies = {};

  if (req.headers && req.headers.cookie) {

    var cookies = req.headers.cookie.split(';');

    for (var i = 0; i < cookies.length; i++) {

      var cookie = cookies[i];

      var parts = cookie.split('=');
      parsedCookies[parts.shift().trim()] = decodeURI(parts.join('='));

    }

  }

  return parsedCookies;
};

function getImageDimensions(toPush, files, fields, parsedCookies, callback) {

  uploadHandler.getImageBounds(toPush.pathInDisk, function gotBounds(error,
      width, height) {
    if (!error) {
      toPush.width = width;
      toPush.height = height;

      fields.files.push(toPush);
    }

    transferFileInformation(files, fields, parsedCookies, callback);
  });

}

function getWebmDimentions(toPush, files, fields, parsedCookies, callback) {

  uploadHandler.getWebmBounds(toPush.pathInDisk, function gotBounds(error,
      width, height) {
    if (!error) {
      toPush.width = width;
      toPush.height = height;

      fields.files.push(toPush);
    }

    transferFileInformation(files, fields, parsedCookies, callback);
  });

}

function getCheckSum(path, callback) {

  var stream = fs.createReadStream(path);
  var hash = crypto.createHash('md5');

  stream.on('data', function(data) {
    hash.update(data, 'utf8');
  });

  stream.on('end', function() {
    callback(hash.digest('hex'));
  });

}

function transferFileInformation(files, fields, parsedCookies, callback) {

  if (files.files.length && fields.files.length < maxFiles) {

    var file = files.files.shift();

    getCheckSum(file.path, function gotCheckSum(checkSum) {
      var mime = file.headers['content-type'];

      var acceptableSize = file.size && file.size < maxFileSize;

      if (acceptableSize && acceptedMimes.indexOf(mime) > -1) {
        var toPush = {
          size : file.size,
          md5 : checkSum,
          title : file.originalFilename,
          pathInDisk : file.path,
          mime : mime
        };

        if (toPush.mime.indexOf('image/') > -1) {

          getImageDimensions(toPush, files, fields, parsedCookies, callback);

        } else if (toPush.mime === 'video/webm' && settings.webmThumb) {
          getWebmDimentions(toPush, files, fields, parsedCookies, callback);
        } else {
          fields.files.push(toPush);

          transferFileInformation(files, fields, parsedCookies, callback);
        }

      } else {
        transferFileInformation(files, fields, parsedCookies, callback);
      }
    });

  } else {
    if (verbose) {
      console.log('Form input: ' + JSON.stringify(fields));
    }

    callback(parsedCookies, fields);
  }

}

function processParsedRequest(res, fields, files, callback, parsedCookies) {

  for ( var key in fields) {
    if (fields.hasOwnProperty(key)) {
      fields[key] = fields[key][0];
    }
  }

  fields.files = [];

  if (files.files) {

    transferFileInformation(files, fields, parsedCookies, callback);

  } else {
    if (verbose) {
      console.log('Form input: ' + JSON.stringify(fields));
    }

    callback(parsedCookies, fields);
  }

}

function redirectToLogin(res) {

  var header = [ [ 'Location', '/login.html' ] ];

  res.writeHead(302, header);

  res.end();
}

exports.getAuthenticatedPost = function(req, res, getParameters, callback,
    optionalAuth) {

  if (getParameters) {

    exports.getPostData(req, res, function(auth, parameters) {

      accountOps.validate(auth, function validated(error, newAuth, userData) {
        if (error && !optionalAuth) {
          redirectToLogin(res);
        } else {
          callback(newAuth, userData, parameters);
        }

      });
    });
  } else {

    accountOps.validate(exports.getCookies(req), function validated(error,
        newAuth, userData) {

      if (error && !optionalAuth) {
        redirectToLogin(res);
      } else {
        callback(newAuth, userData);
      }
    });
  }

};

exports.getPostData = function(req, res, callback) {

  try {

    var parser = new multiParty.Form({
      uploadDir : uploadDir,
      autoFiles : true
    });

    var filesToDelete = [];

    var endingCb = function() {

      for (var j = 0; j < filesToDelete.length; j++) {

        uploadHandler.removeFromDisk(filesToDelete[j]);
      }

    };

    res.on('close', endingCb);

    res.on('finish', endingCb);

    parser.on('file', function(name, file) {

      filesToDelete.push(file.path);

    });

    parser.on('progress', function(bytesReceived) {
      if (bytesReceived > maxRequestSize) {
        req.connection.destroy();
      }
    });

    parser.parse(req, function parsed(error, fields, files) {

      if (error) {
        exports.outputError(error, 500, res);
      } else {
        processParsedRequest(res, fields, files, callback, exports
            .getCookies(req));

      }

    });

  } catch (error) {
    exports.outputError(error, 500, res);
  }

};

function setCookies(header, cookies) {

  for (var i = 0; i < cookies.length; i++) {
    var cookie = cookies[i];

    var toPush = [ 'Set-Cookie', cookie.field + '=' + cookie.value ];

    if (cookie.expiration) {
      toPush[1] += '; expires=' + cookie.expiration.toString();
    }

    if (cookie.path) {
      toPush[1] += '; path=' + cookie.path;
    }

    header.push(toPush);

  }
}

exports.outputResponse = function(message, redirect, res, cookies, authBlock) {

  if (verbose) {
    console.log(message);
  }

  var header = miscOps.corsHeader('text/html');

  if (authBlock && authBlock.authStatus === 'expired') {
    header.push([ 'Set-Cookie', 'hash=' + authBlock.newHash ]);
  }

  if (cookies) {

    setCookies(header, cookies);

  }

  res.writeHead(200, header);

  res.end(domManipulator.message(message, redirect));

};

exports.outputError = function(error, code, res) {

  if (verbose) {
    console.log(error);
  }

  if (debug) {
    throw error;
  }

  res.writeHead(code, miscOps.corsHeader('text/html'));

  res.end(domManipulator.error(code, error.toString()));

};

exports.checkBlankParameters = function(object, parameters, res) {

  function failCheck(parameter, reason) {

    if (verbose) {
      console.log('Blank reason: ' + reason);
    }

    if (res) {
      var message = lang.errBlankParameter.replace('{$parameter}', parameter)
          .replace('{$reason}', reason);

      exports.outputError(message, 400, res);
    }

    return true;
  }

  if (!object) {

    failCheck();

    return true;

  }

  for (var i = 0; i < parameters.length; i++) {
    var parameter = parameters[i];

    if (!object.hasOwnProperty(parameter)) {
      return failCheck(parameter, lang.miscReasonNotPresent);

    }

    if (object[parameter] === null) {
      return failCheck(parameter, lang.miscReasonNnull);
    }

    if (object[parameter] === undefined) {
      return failCheck(parameter, lang.miscReasonUndefined);
    }

    if (!object[parameter].toString().trim().length) {
      return failCheck(parameter, lang.miscReasonNoLength);
    }
  }

  return false;

};

exports.checkForBan = function(req, boardUri, res, callback) {

  modOps.checkForBan(req, boardUri, function gotBan(error, ban) {
    if (error) {
      callback(error);
    } else if (ban) {
      res.writeHead(200, miscOps.corsHeader('text/html'));

      var board = ban.boardUri ? '/' + ban.boardUri + '/' : lang.miscAllBoards
          .toLowerCase();

      res.end(domManipulator.ban(ban, board));
    } else {
      callback();
    }
  });

};