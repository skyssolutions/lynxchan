'use strict';

// general operations for the form api

var fs = require('fs');
var crypto = require('crypto');
var url = require('url');
var debug = require('../kernel').debug();
var multiParty = require('multiparty');
var bans = require('../db').bans();
var verbose;
var uploadDir;
var maxRequestSize;
var maxFileSize;
var maxFiles;
var accountOps;
var uploadHandler;
var modOps;
var miscOps;
var domManipulator;
var lang;
var uploadHandler;
var validMimes;
var videoMimes;
var mediaThumb;

exports.loadSettings = function() {

  var settings = require('../settingsHandler').getGeneralSettings();

  verbose = settings.verbose || settings.verboseApis;
  uploadDir = settings.tempDirectory;
  maxRequestSize = settings.maxRequestSizeB;
  maxFileSize = settings.maxFileSizeB;
  maxFiles = settings.maxFiles;
  mediaThumb = settings.mediaThumb;
  validMimes = settings.acceptedMimes;

};

exports.loadDependencies = function() {

  accountOps = require('./accountOps');
  uploadHandler = require('./uploadHandler');
  modOps = require('./modOps');
  miscOps = require('./miscOps');
  domManipulator = require('./domManipulator').dynamicPages.miscPages;
  lang = require('./langOps').languagePack;
  uploadHandler = require('./uploadHandler');
  videoMimes = uploadHandler.videoMimes;

};

exports.getDomain = function(req) {
  return 'http://' + req.headers.host;
};

exports.getCookies = function(req) {
  var parsedCookies = {};

  if (req.headers.cookie) {

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
    video = video && mediaThumb;

    var measureFunction;

    if (toPush.mime.indexOf('image/') > -1) {
      measureFunction = uploadHandler.getImageBounds;
    } else if (video) {
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
    res, exceptionalMimes, language) {

  if (files.files.length && fields.files.length < maxFiles) {

    var file = files.files.shift();

    if (!file.headers['content-type']) {
      exports.transferFileInformation(files, fields, parsedCookies, cb, res,
          exceptionalMimes, language);

      return;
    }

    var mime = file.headers['content-type'].toLowerCase().trim();

    var acceptableSize = file.size && file.size < maxFileSize;

    if (validMimes.indexOf(mime) === -1 && !exceptionalMimes && file.size) {
      exports.outputError(lang(language).errFormatNotAllowed, 500, res,
          language);
    } else if (acceptableSize) {

      exports.getFileData(file, fields, mime, function gotFileData(error) {
        if (error) {
          if (debug) {
            throw error;
          } else if (verbose) {
            console.log(error);
          }

        }

        exports.transferFileInformation(files, fields, parsedCookies, cb, res,
            exceptionalMimes, language);

      });
    } else if (file.size) {
      exports.outputError(lang(language).errFileTooLarge, 500, res, language);
    } else {
      exports.transferFileInformation(files, fields, parsedCookies, cb, res,
          exceptionalMimes, language);
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
    parsedCookies, exceptionalMimes, language) {

  for ( var key in fields) {
    if (fields.hasOwnProperty(key)) {
      fields[key] = fields[key][0];
    }
  }

  fields.files = [];

  if (files.files) {

    exports.transferFileInformation(files, fields, parsedCookies, callback,
        res, exceptionalMimes, language);

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
    autoFiles : true,
    maxFilesSize : maxRequestSize
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
    exports.outputError(error, 500, res, req.language);
  });

  parser.on('file', function(name, file) {
    filesToDelete.push(file.path);
  });

  parser.parse(req, function parsed(error, fields, files) {

    if (error) {
      exports.outputError(error, 500, res, req.language);
    } else {
      exports.processParsedRequest(res, fields, files, callback, exports
          .getCookies(req), exceptionalMimes, req.language);

    }

  });

};

exports.checkReferer = function(req) {

  if (!req.headers.referer) {
    return false;
  }

  var parsedReferer = url.parse(req.headers.referer);

  var finalReferer = parsedReferer.hostname;
  finalReferer += (parsedReferer.port ? ':' + parsedReferer.port : '');

  return finalReferer === req.headers.host;

};

exports.getAuthenticatedPost = function(req, res, getParameters, callback,
    optionalAuth, exceptionalMimes, skipReferer) {

  if (!skipReferer && !exports.checkReferer(req)) {

    if (!optionalAuth) {
      exports.redirectToLogin(res);
    } else if (getParameters) {
      exports.getPostData(req, res, function(auth, parameters) {
        callback(null, null, parameters);
      }, exceptionalMimes);
    } else {
      callback();
    }

    return;
  }

  if (getParameters) {

    exports.getPostData(req, res, function(auth, parameters) {

      accountOps.validate(auth, req.language, function validated(error,
          newAuth, userData) {
        if (error && !optionalAuth) {
          exports.redirectToLogin(res);
        } else {
          callback(newAuth, userData, parameters);
        }

      });
    }, exceptionalMimes);
  } else {

    accountOps.validate(exports.getCookies(req), req.language,
        function validated(error, newAuth, userData) {

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

  res.writeHead(302, {
    Location : '/login.html'
  });
  res.end();

};

exports.setCookies = function(header, cookies) {

  for (var i = 0; i < cookies.length; i++) {
    var cookie = cookies[i];

    var toPush = [ 'Set-Cookie', cookie.field + '=' + cookie.value ];

    if (cookie.expiration) {
      toPush[1] += '; expires=' + cookie.expiration.toUTCString();
    }

    if (cookie.path) {
      toPush[1] += '; path=' + cookie.path;
    }

    header.push(toPush);

  }
};

exports.outputResponse = function(message, redirect, res, cookies, authBlock,
    language) {

  if (verbose) {
    console.log(message);
  }

  var header = [];

  if (cookies) {
    exports.setCookies(header, cookies);
  }

  res.writeHead(200, miscOps.getHeader('text/html', authBlock, header));

  res.end(domManipulator.message(message, redirect, language));

};

exports.outputError = function(error, code, res, language, json) {

  if (debug) {
    throw error;
  } else if (verbose) {
    console.log(error);
  }

  if (!res) {
    res = code;
    code = 500;
  }

  res.writeHead(code, miscOps
      .getHeader(json ? 'application/json' : 'text/html'));

  res.end(json ? JSON.stringify(error.toString()) : domManipulator.error(code,
      error.toString(), language));

};

exports.failCheck = function(parameter, reason, res, language) {

  if (verbose) {
    console.log('Blank reason: ' + reason);
  }

  if (res) {
    var message = lang(language).errBlankParameter.replace('{$parameter}',
        parameter).replace('{$reason}', reason);

    exports.outputError(message, 400, res, language);
  }

  return true;

};

exports.checkBlankParameters = function(object, parameters, res, language) {

  if (!object) {
    return exports.failCheck(null, null, null, language);
  }

  if (!object.hasOwnProperty) {
    object = JSON.parse(JSON.stringify(object));
  }

  for (var i = 0; i < parameters.length; i++) {
    var parameter = parameters[i];

    if (!object.hasOwnProperty(parameter)) {
      return exports.failCheck(parameter, lang(language).miscReasonNotPresent,
          res, language);

    }

    if (object[parameter] === null) {
      return exports.failCheck(parameter, lang(language).miscReasonNnull, res,
          language);
    }

    if (object[parameter] === undefined) {
      return exports.failCheck(parameter, lang(language).miscReasonUndefined,
          res, language);
    }

    if (!object[parameter].trim().length) {
      return exports.failCheck(parameter, lang(language).miscReasonNoLength,
          res, language);
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

      res.writeHead(302, miscOps.convertHeader(header));

      res.end();

    } else if (error) {
      callback(error);
    } else if (ban) {
      if (ban.range && req.bypassed) {
        callback();
        return;
      }

      res.writeHead(200, miscOps.getHeader('text/html', auth));

      var board = ban.boardUri ? '/' + ban.boardUri + '/'
          : lang(req.language).miscAllBoards.toLowerCase();

      res.end(domManipulator.ban(ban, board, req.language));
    } else {
      callback();
    }
  });

};

exports.checkForHashBan = function(parameters, req, res, callback, auth) {

  modOps.hashBan.checkForHashBans(parameters, req, function gotBans(error,
      hashBans) {
    if (error) {
      callback(error);
    } else if (!hashBans) {
      callback();
    } else {

      res.writeHead(200, miscOps.getHeader('text/html', auth));

      res.end(domManipulator.hashBan(hashBans, req.language));
    }
  });

};
