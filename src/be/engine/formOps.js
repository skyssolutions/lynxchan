'use strict';

// general operations for the form api

var settings = require('../settingsHandler').getGeneralSettings();
var bans = require('../db').bans();
var fs = require('fs');
var crypto = require('crypto');
var debug = require('../kernel').debug();
var verbose = settings.verbose;
var multiParty = require('multiparty');
var jsdom = require('jsdom').jsdom;
var uploadDir = settings.tempDirectory;
var maxRequestSize = settings.maxRequestSizeB;
var maxFileSize = settings.maxFileSizeB;
var maxFiles = settings.maxFiles;
var accountOps;
var uploadHandler;
var modOps;
var miscOps;
var domManipulator;
var lang;
var uploadHandler;
var validMimes;
var videoMimes;

exports.loadDependencies = function() {

  accountOps = require('./accountOps');
  uploadHandler = require('./uploadHandler');
  modOps = require('./modOps');
  miscOps = require('./miscOps');
  domManipulator = require('./domManipulator').dynamicPages.miscPages;
  lang = require('./langOps').languagePack();
  uploadHandler = require('./uploadHandler');
  validMimes = uploadHandler.supportedMimes();
  videoMimes = uploadHandler.videoMimes();

};

exports.getDomain = function(req) {
  return 'http://' + req.headers.host;
};

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

// Section 1: Request parsing {

// Section 1.1: File processing {
exports.getCheckSum = function(path, callback) {

  var stream = fs.createReadStream(path);
  var hash = crypto.createHash('md5');

  stream.on('data', function(data) {
    hash.update(data, 'utf8');
  });

  stream.on('end', function() {
    callback(hash.digest('hex'));
  });

};

exports.getFileData = function(file, fields, mime, callback) {

  exports.getCheckSum(file.path, function gotCheckSum(checkSum) {

    var toPush = {
      size : file.size,
      md5 : checkSum,
      title : file.originalFilename,
      pathInDisk : file.path,
      mime : mime
    };

    var video = videoMimes.indexOf(toPush.mime) > -1;
    video = video && settings.mediaThumb;

    var measureFunction;

    if (toPush.mime.indexOf('image/') > -1) {
      measureFunction = uploadHandler.getImageBounds;
    } else if (video && settings.mediaThumb) {
      measureFunction = uploadHandler.getVideoBounds;
    }

    if (measureFunction) {

      // style exception, too simple
      measureFunction(toPush, function gotDimensions(error, width, height) {
        if (!error) {
          toPush.width = width;
          toPush.height = height;

          fields.files.push(toPush);
        }

        callback(error);
      });
      // style exception, too simple

    } else {
      fields.files.push(toPush);

      callback();
    }
  });
};

exports.transferFileInformation = function(files, fields, parsedCookies, cb,
    res, exceptionalMimes) {

  if (files.files.length && fields.files.length < maxFiles) {

    var file = files.files.shift();

    var mime = file.headers['content-type'];

    var acceptableSize = file.size && file.size < maxFileSize;

    if (validMimes.indexOf(mime) === -1 && !exceptionalMimes && file.size) {
      exports.outputError(lang.errFormatNotAllowed, 500, res);
    } else if (acceptableSize) {

      exports.getFileData(file, fields, mime, function gotFileData(error) {
        if (error) {
          if (verbose) {
            console.log(error);
          }

          if (debug) {
            throw error;
          }

        }

        exports.transferFileInformation(files, fields, parsedCookies, cb, res,
            exceptionalMimes);

      });
    } else if (file.size) {
      exports.outputError(lang.errFileTooLarge, 500, res);
    } else {
      exports.transferFileInformation(files, fields, parsedCookies, cb, res,
          exceptionalMimes);
    }

  } else {
    if (verbose) {
      console.log('Form input: ' + JSON.stringify(fields, null, 2));
    }

    cb(parsedCookies, fields);
  }

};
// } Section 1.1: File processing

exports.processParsedRequest = function(res, fields, files, callback,
    parsedCookies, exceptionalMimes) {

  for ( var key in fields) {
    if (fields.hasOwnProperty(key)) {
      fields[key] = fields[key][0];
    }
  }

  fields.files = [];

  if (files.files) {

    exports.transferFileInformation(files, fields, parsedCookies, callback,
        res, exceptionalMimes);

  } else {
    if (verbose) {
      console.log('Form input: ' + JSON.stringify(fields, null, 2));
    }

    callback(parsedCookies, fields);
  }

};

exports.getPostData = function(req, res, callback, exceptionalMimes) {

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

  parser.on('error', function(error) {
    if (verbose) {
      console.log(error);
    }

    req.connection.destroy();
  });

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
      exports.processParsedRequest(res, fields, files, callback, exports
          .getCookies(req), exceptionalMimes);

    }

  });

};

exports.getAuthenticatedPost = function(req, res, getParameters, callback,
    optionalAuth, exceptionalMimes) {

  if (getParameters) {

    exports.getPostData(req, res, function(auth, parameters) {

      accountOps.validate(auth, function validated(error, newAuth, userData) {
        if (error && !optionalAuth) {
          exports.redirectToLogin(res);
        } else {
          callback(newAuth, userData, parameters);
        }

      });
    }, exceptionalMimes);
  } else {

    accountOps.validate(exports.getCookies(req), function validated(error,
        newAuth, userData) {

      if (error && !optionalAuth) {
        exports.redirectToLogin(res);
      } else {
        callback(newAuth, userData);
      }
    });
  }

};
// } Section 1: Request parsing

exports.redirectToLogin = function(res) {

  var header = [ [ 'Location', '/login.html' ] ];

  res.writeHead(302, header);

  res.end();
};

exports.setCookies = function(header, cookies) {

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
};

exports.outputResponse = function(message, redirect, res, cookies, authBlock) {

  if (verbose) {
    console.log(message);
  }

  var header = miscOps.corsHeader('text/html');

  if (authBlock && authBlock.authStatus === 'expired') {
    header.push([ 'Set-Cookie', 'hash=' + authBlock.newHash ]);
  }

  if (cookies) {
    exports.setCookies(header, cookies);
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

  if (!res) {
    res = code;
    code = 500;
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

exports.checkForBan = function(req, boardUri, res, callback, auth) {

  modOps.ipBan.versatile.checkForBan(req, boardUri, function gotBan(error, ban,
      bypassable) {

    if (bypassable && !req.bypassed) {

      var header = [ [ 'Location', '/blockBypass.js' ] ];

      if (auth && auth.authStatus === 'expired') {
        header.push([ 'Set-Cookie', 'hash=' + auth.newHash ]);
      }

      res.writeHead(302, header);

      res.end();

    } else if (error) {
      callback(error);
    } else if (ban) {
      if (ban.range && req.bypassed) {
        callback();
        return;
      }

      res.writeHead(200, miscOps.corsHeader('text/html', auth));

      var board = ban.boardUri ? '/' + ban.boardUri + '/' : lang.miscAllBoards
          .toLowerCase();

      res.end(domManipulator.ban(ban, board));
    } else {
      callback();
    }
  });

};

exports.checkForHashBan = function(parameters, req, res, callback) {

  modOps.hashBan.checkForHashBans(parameters, req, function gotBans(error,
      hashBans) {
    if (error) {
      callback(error);
    } else if (!hashBans) {
      callback();
    } else {
      res.end(domManipulator.hashBan(hashBans));
    }
  });

};