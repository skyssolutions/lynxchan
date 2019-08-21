'use strict';

// general operations for the form api

var fs = require('fs');
var crypto = require('crypto');
var url = require('url');
var multiParty = require('multiparty');
var logger = require('../logger');
var db = require('../db');
var bans = db.bans();
var references = db.uploadReferences();
var exec = require('child_process').exec;
var verbose;
var uploadDir;
var maxRequestSize;
var maxFileSize;
var maxFiles;
var fileProcessingLimit;
var accountOps;
var uploadHandler;
var modOps;
var miscOps;
var jsonBuilder;
var validateMimes;
var domManipulator;
var lang;
var uploadHandler;
var unboundLimits;
var videoMimes;
var mediaThumb;

exports.loadSettings = function() {

  var settings = require('../settingsHandler').getGeneralSettings();

  fileProcessingLimit = settings.fileProcessingLimit;
  validateMimes = settings.validateMimes;
  verbose = settings.verbose || settings.verboseApis;
  uploadDir = settings.tempDirectory;
  maxRequestSize = settings.maxRequestSizeB;
  maxFileSize = settings.maxFileSizeB;
  maxFiles = settings.maxFiles;
  mediaThumb = settings.mediaThumb;
  unboundLimits = settings.unboundBoardLimits;

};

exports.loadDependencies = function() {

  jsonBuilder = require('./jsonBuilder');
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

exports.json = function(req) {
  return !!url.parse(req.url, true).query.json;
};

// Section 1: Request parsing {

// Section 1.1: File processing {
exports.checkNewFileReference = function(file, callback) {

  var identifier = file.md5 + '-' + file.mime.replace('/', '');

  references.findOne({
    identifier : identifier
  }, function gotReference(error, reference) {

    if (error) {
      callback(error);
    } else {
      file.referenced = !!reference;
      callback();
    }

  });

};

exports.updateMetaMime = function(toPush, mime, fields) {

  if (!fields.metaData) {
    return;
  }

  for (var i = 0; i < fields.metaData.length; i++) {

    var meta = fields.metaData[i];

    if (meta.mime === mime && meta.md5 === toPush.md5) {
      meta.mime = toPush.mime;
    }

  }

};

exports.getFileData = function(file, fields, mime, callback) {

  var toPush = {
    size : file.size,
    md5 : file.md5,
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

      exports.updateMetaMime(toPush, mime, fields);

      if (error) {
        callback(error);
      } else {
        toPush.width = width;
        toPush.height = height;

        fields.files.push(toPush);
        exports.checkNewFileReference(toPush, callback);
      }

    });
    // style exception, too simple

  } else {
    fields.files.push(toPush);

    exports.checkNewFileReference(toPush, callback);
  }

};

exports.transferFileInformation = function(files, fields, parsedCookies, cb,
    res, language, json) {

  if (!files.length || (!unboundLimits && fields.files.length >= maxFiles)) {

    if (verbose) {
      console.log('Form input: ' + JSON.stringify(fields, null, 2));
    }

    exports.applyMetaData(fields, parsedCookies, cb);

    return;
  }

  var file = files.shift();

  if (!file.realMime && !file.headers['content-type']) {
    exports.transferFileInformation(files, fields, parsedCookies, cb, res,
        language, json);

    return;
  }

  var mime = file.realMime || file.headers['content-type'].toLowerCase().trim();

  if (file.size && (unboundLimits || file.size < maxFileSize)) {

    exports.getFileData(file, fields, mime, function gotFileData(error) {

      if (error && verbose) {
        console.log(error);
      }

      exports.transferFileInformation(files, fields, parsedCookies, cb, res,
          language, json);

    });

  } else if (file.size) {
    exports.outputError(lang(language).errFileTooLarge, 500, res, language,
        json);
  } else {
    exports.transferFileInformation(files, fields, parsedCookies, cb, res,
        language, json);
  }

};
// } Section 1.1: File processing

exports.getNewFiles = function(newFiles, fields, relation) {

  for (var i = 0; i < Math.min(fields.metaData.length,
      unboundLimits ? fields.metaData.length : maxFiles); i++) {

    var metaData = fields.metaData[i];

    var identifier = metaData.md5 + '-' + metaData.mime.replace('/', '');

    var file = relation[identifier];

    if (!file) {

      if (metaData.size) {
        newFiles.push(metaData);
      }

      continue;
    }

    metaData.size = file.size;
    metaData.width = file.width;
    metaData.height = file.height;
    metaData.pathInDisk = file.pathInDisk;

    newFiles.push(metaData);

  }

};

exports.applyMetaData = function(fields, parsedCookies, cb) {

  if (fields.metaData.length) {

    var relation = {};

    for (var i = 0; i < fields.files.length; i++) {

      var file = fields.files[i];
      relation[file.md5 + '-' + file.mime.replace('/', '')] = file;

    }

    var newFiles = [];
    exports.getNewFiles(newFiles, fields, relation);
    fields.files = newFiles;

  }

  delete fields.metaData;

  cb(parsedCookies, fields);

};

exports.processReferencedFiles = function(metaData, callback, index) {

  index = index || 0;

  if (index >= metaData.length || (!unboundLimits && index >= maxFiles)) {
    callback();
    return;
  }

  var entry = metaData[index];

  references.findOne({
    identifier : entry.md5 + '-' + entry.mime.replace('/', '')
  }, function gotEntry(error, reference) {

    if (reference) {
      entry.width = reference.width;
      entry.height = reference.height;
      entry.size = reference.size;
      entry.referenced = true;
    }

    exports.processReferencedFiles(metaData, callback, ++index);

  });

};

exports.getRealMimeRelation = function(files) {

  var realMimeRelation = {};

  for (var i = 0; files.files && i < files.files.length; i++) {
    var file = files.files[i];

    if (!file.realMime || file.headers['content-type'] === file.realMime) {
      continue;
    }

    var identifier = file.md5 + '-';
    identifier += file.headers['content-type'].replace('/', '');

    realMimeRelation[identifier] = file.realMime;

  }

  return realMimeRelation;

};

exports.getMetaData = function(fields, files) {

  var fileMetaData = [];

  var realMimeRelation = exports.getRealMimeRelation(files);

  var spoiled = fields.fileSpoiler || [];
  var md5 = fields.fileMd5 || [];
  var mime = fields.fileMime || [];
  var name = fields.fileName || [];

  var min = Math.min(spoiled.length, md5.length);
  min = Math.min(min, mime.length);
  min = Math.min(min, name.length);

  for (var i = 0; i < Math.min(min, fileProcessingLimit); i++) {

    if (!md5[i] || !mime[i] || !name[i]) {
      continue;
    }

    var realMime = realMimeRelation[md5[i] + '-' + mime[i].replace('/', '')];

    fileMetaData.push({
      spoiler : spoiled[i],
      md5 : md5[i],
      mime : realMime || mime[i],
      title : name[i]
    });

  }

  return fileMetaData;

};

exports.processParsedRequest = function(res, fields, files, callback,
    parsedCookies, language, json) {

  var fileMetaData = exports.getMetaData(fields, files);

  delete fields.fileSpoiler;
  delete fields.fileMime;
  delete fields.fileMd5;
  delete fields.fileName;

  for ( var key in fields) {
    if (fields.hasOwnProperty(key)) {
      fields[key] = fields[key][0];
    }
  }

  exports.processReferencedFiles(fileMetaData, function(error) {

    if (error) {
      callback(error);
    } else {

      fields.files = [];
      fields.metaData = fileMetaData;

      exports.transferFileInformation(files.files || [], fields, parsedCookies,
          callback, res, language, json);

    }

  });

};

exports.getCheckSums = function(res, fields, files, callback, parsedCookies,
    language, json, index) {

  if (!files.files) {
    return exports.processParsedRequest(res, fields, files, callback,
        parsedCookies, language, json);
  }

  index = index || 0;

  var file = files.files[index];

  if (!file) {
    return exports.processParsedRequest(res, fields, files, callback,
        parsedCookies, language, json);
  }

  var stream = fs.createReadStream(file.path);
  var hash = crypto.createHash('md5');

  stream.on('error', callback);

  stream.on('data', function(data) {
    hash.update(data, 'utf8');
  });

  stream.on('end', function() {

    file.md5 = hash.digest('hex');

    exports.getCheckSums(res, fields, files, callback, parsedCookies, language,
        json, ++index);
  });

};

exports.validateMimes = function(res, fields, files, callback, parsedCookies,
    language, json, index) {

  if (!validateMimes || !files.files) {

    return exports.getCheckSums(res, fields, files, callback, parsedCookies,
        language, json);
  }

  index = index || 0;

  var file = files.files[index];

  if (!file) {

    return exports.getCheckSums(res, fields, files, callback, parsedCookies,
        language, json);
  }

  exec('file -b --mime-type ' + file.path, function(error, receivedMime) {

    if (error) {
      callback(error);
    } else {

      file.realMime = receivedMime.trim();

      if (!file.realMime.indexOf('text/')) {
        var actualRealMime = logger.getMime(file.originalFilename);

        if (actualRealMime !== 'application/octet-stream') {
          file.realMime = actualRealMime;
        }

      }

      exports.validateMimes(res, fields, files, callback, parsedCookies,
          language, json, ++index);
    }
  });

};

exports.getPostData = function(req, res, callback) {

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

  var json = exports.json(req);

  res.on('close', endingCb);

  res.on('finish', endingCb);

  parser.on('error', function(error) {
    exports.outputError(error, 500, res, req.language, json);
  });

  parser.on('file', function(name, file) {
    filesToDelete.push(file.path);
  });

  parser.parse(req, function parsed(error, fields, files) {

    if (error) {
      exports.outputError(error, 500, res, req.language, json);
    } else {

      if (files.files && files.files.length > fileProcessingLimit) {
        files.files.splice(fileProcessingLimit - files.files.length);
      }

      exports.validateMimes(res, fields, files, callback, exports
          .getCookies(req), req.language, json);
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
    optionalAuth, skipReferer) {

  var json = exports.json(req);

  if (!skipReferer && !exports.checkReferer(req)) {

    if (!optionalAuth) {

      if (json) {
        exports.outputError(lang(req.language).errReferralMismatch, null, res,
            null, true);
      } else {
        exports.redirectToLogin(res);
      }

    } else if (getParameters) {
      exports.getPostData(req, res, function(auth, parameters) {
        callback(null, null, parameters);
      });
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

          if (json) {
            exports.outputError(error, null, res, null, true);
          } else {
            exports.redirectToLogin(res, skipReferer, req);
          }

        } else {
          callback(newAuth, userData, parameters);
        }

      });
    });
  } else {

    accountOps.validate(exports.getCookies(req), req.language,
        function validated(error, newAuth, userData) {

          if (error && !optionalAuth) {
            if (json) {
              exports.outputError(error, null, res, null, true);
            } else {
              exports.redirectToLogin(res, skipReferer, req);
            }

          } else {
            callback(newAuth, userData);
          }
        });
  }

};
// } Section 1: Request parsing

exports.redirectToLogin = function(res, skipReferer, req) {

  var headers = [ [ 'Location', '/login.html' ] ];

  var cookies;

  if (skipReferer) {

    var now = new Date();
    now.setUTCMinutes(now.getUTCMinutes() + 10);

    cookies = [ {
      field : 'loginredirect',
      value : url.parse(req.url).path,
      expiration : now,
      path : '/'
    } ];

  }

  res.writeHead(302, miscOps.getHeader(null, null, headers, cookies));
  res.end();

};

exports.outputResponse = function(message, redirect, res, cookies, authBlock,
    language, json) {

  if (verbose) {
    console.log(message);
  }

  res.writeHead(200, miscOps.getHeader(json ? 'application/json' : 'text/html',
      authBlock, null, cookies));

  res.end(json ? jsonBuilder.message(message, redirect) : domManipulator
      .message(message, redirect, language));

};

exports.outputError = function(error, code, res, language, json, auth) {

  if (verbose) {
    console.log(error);
  }

  res.writeHead(json ? 200 : code, miscOps.getHeader(json ? 'application/json'
      : 'text/html', auth));

  res.end(json ? jsonBuilder.message('error', error.toString())
      : domManipulator.error(code, error.toString(), language));

};

exports.failCheck = function(json, parameter, reason, res, language) {

  if (verbose) {
    console.log('Blank reason: ' + reason);
  }

  if (res) {
    var message = lang(language).errBlankParameter.replace('{$parameter}',
        parameter).replace('{$reason}', reason);

    exports.outputError(message, 400, res, language, json);
  }

  return true;

};

exports.checkBlankParameters = function(object, params, res, language, json) {

  if (!object) {
    return exports.failCheck(json, null, null, null, language);
  }

  if (!object.hasOwnProperty) {
    object = JSON.parse(JSON.stringify(object));
  }

  for (var i = 0; i < params.length; i++) {
    var parameter = params[i];

    if (!object.hasOwnProperty(parameter)) {
      return exports.failCheck(json, parameter,
          lang(language).miscReasonNotPresent, res, language);

    }

    if (object[parameter] === null) {
      return exports.failCheck(json, parameter, lang(language).miscReasonNnull,
          res, language);
    }

    if (object[parameter] === undefined) {
      return exports.failCheck(json, parameter,
          lang(language).miscReasonUndefined, res, language);
    }

    if (!object[parameter].trim().length) {
      return exports.failCheck(json, parameter,
          lang(language).miscReasonNoLength, res, language);
    }
  }

  return false;

};

exports.outputBan = function(ban, req, res, json, callback, auth) {

  if ((ban.range || ban.asn) && req.bypassed) {
    callback();
    return;
  }

  res.writeHead(200, miscOps.getHeader(json ? 'application/json' : 'text/html',
      auth));

  if (ban.range) {
    ban.range = ban.range.join('.');
  }

  if (json) {

    res.end(jsonBuilder.message('banned', {
      reason : ban.reason,
      asn : ban.asn,
      appealled : !!ban.appeal,
      range : ban.range,
      banId : ban._id,
      expiration : ban.expiration,
      board : ban.boardUri ? '/' + ban.boardUri + '/'
          : lang(req.language).miscAllBoards.toLowerCase()
    }));

  } else {

    var board = ban.boardUri ? '/' + ban.boardUri + '/'
        : lang(req.language).miscAllBoards.toLowerCase();
    res.end(domManipulator.ban(ban, board, req.language));

  }

};

exports.checkForBan = function(req, boardUri, res, callback, auth, json) {

  modOps.ipBan.versatile.checkForBan(req, boardUri, function gotBan(error, ban,
      bypassable) {

    if (bypassable && !req.bypassed) {

      if (json) {

        res.writeHead(200, miscOps.getHeader('application/json', auth));
        res.end(jsonBuilder.message('bypassable'));

      } else {

        res.writeHead(302, miscOps.getHeader(null, auth, [ [ 'Location',
            '/blockBypass.js' ] ]));
        res.end();

      }

    } else if (error) {
      callback(error);
    } else if (ban) {
      exports.outputBan(ban, req, res, json, callback, auth);
    } else {
      callback();
    }
  });

};

exports.checkForHashBan = function(parameters, req, res, callback, auth, json) {

  modOps.hashBan.checkForHashBans(parameters, req, function gotBans(error,
      hashBans) {
    if (error) {
      callback(error);
    } else if (!hashBans) {
      callback();
    } else {

      res.writeHead(200, miscOps.getHeader(json ? 'application/json'
          : 'text/html', auth));

      res.end(json ? jsonBuilder.message('hashBan', hashBans) : domManipulator
          .hashBan(hashBans, req.language));
    }
  });

};
