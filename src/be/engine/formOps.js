'use strict';

// general operations for the form api

var fs = require('fs');
var url = require('url');
var formidable = require('formidable');
var logger = require('../logger');
var db = require('../db');
var exifCommand = 'exiftool -all= -tagsfromfile @ -Orientation -ColorSpaceTags';
exifCommand += ' {$file} -overwrite_original';
var bans = db.bans();
var references = db.uploadReferences();
var exec = require('child_process').exec;
var verbose;
var uploadDir;
var maxRequestSize;
var fileProcessingLimit;
var accountOps;
var uploadHandler;
var modOps;
var miscOps;
var jsonBuilder;
var stripExif;
var validateMimes;
var domManipulator;
var lang;
var useCacheControl;
var uploadHandler;
var mediaThumb;

exports.loadSettings = function() {

  var settings = require('../settingsHandler').getGeneralSettings();

  useCacheControl = settings.useCacheControl;
  stripExif = settings.stripExif;
  fileProcessingLimit = settings.fileProcessingLimit;
  validateMimes = settings.validateMimes;
  verbose = settings.verbose || settings.verboseApis;
  uploadDir = settings.tempDirectory;
  maxRequestSize = settings.maxRequestSizeB;
  mediaThumb = settings.mediaThumb;

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

  references.findOne({
    sha256 : file.sha256
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

    if (meta.sha256 === toPush.sha256) {
      meta.mime = toPush.mime;
    }

  }

};

exports.getFileData = function(file, fields, mime, callback) {

  var toPush = {
    size : file.size,
    sha256 : file.sha256,
    title : file.name,
    pathInDisk : file.path,
    mime : mime
  };

  var measureFunction;

  if (toPush.mime.indexOf('image/') > -1) {
    measureFunction = uploadHandler.getImageBounds;
  } else if (toPush.mime.indexOf('video/') > -1 && mediaThumb) {
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

exports.applyMetaData = function(fields, cb) {

  if (fields.metaData.length) {

    var relation = {};

    for (var i = 0; i < fields.files.length; i++) {

      var file = fields.files[i];
      relation[file.sha256] = file;

    }

    var newFiles = [];
    exports.getNewFiles(newFiles, fields, relation);
    fields.files = newFiles;

  }

  delete fields.metaData;

  cb(null, fields);

};

exports.transferFileInformation = function(files, fields, cb) {

  if (!files.length) {

    if (verbose) {
      console.log('Form input: ' + JSON.stringify(fields, null, 2));
    }

    return exports.applyMetaData(fields, cb);

  }

  var file = files.shift();

  if (!file.realMime && !file.type) {
    return exports.transferFileInformation(files, fields, cb);
  }

  var mime = file.realMime || file.type.toLowerCase().trim();

  if (file.size) {

    exports.getFileData(file, fields, mime, function gotFileData(error) {

      if (error && verbose) {
        console.log(error);
      }

      exports.transferFileInformation(files, fields, cb);

    });

  } else {
    exports.transferFileInformation(files, fields, cb);
  }

};
// } Section 1.1: File processing

exports.getNewFiles = function(newFiles, fields, relation) {

  for (var i = 0; i < fields.metaData.length; i++) {

    var metaData = fields.metaData[i];

    var file = relation[metaData.sha256];

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

exports.processReferencedFiles = function(fields, files, callback, index) {

  index = index || 0;

  if (index >= files.metadata.length) {

    fields.files = [];
    fields.metaData = files.metadata;

    return exports.transferFileInformation(files.files, fields, callback);

  }

  var entry = files.metadata[index];

  references.findOne({
    sha256 : entry.sha256
  }, function gotEntry(error, reference) {

    if (reference) {
      entry.width = reference.width;
      entry.height = reference.height;
      entry.size = reference.size;
      entry.referenced = true;
    }

    exports.processReferencedFiles(fields, files, callback, ++index);

  });

};

exports.stripExifs = function(fields, files, callback, index) {

  if (!stripExif) {
    return exports.processReferencedFiles(fields, files, callback);
  }

  index = index || 0;

  var file = files.files[index];

  if (!file) {
    return exports.processReferencedFiles(fields, files, callback);
  }

  exec(exifCommand.replace('{$file}', file.path), function(error) {
    exports.stripExifs(fields, files, callback, ++index);
  });

};

exports.getRealMimeRelation = function(files) {

  var realMimeRelation = {};

  for (var i = 0; files.files && i < files.files.length; i++) {
    var file = files.files[i];

    if (!file.realMime || file.type === file.realMime) {
      continue;
    }

    realMimeRelation[file.sha256] = file.realMime;

  }

  return realMimeRelation;

};

exports.applyRealMimes = function(fields, files, callback) {

  var realMimeRelation = exports.getRealMimeRelation(files);

  for (var i = 0; i < files.metadata.length; i++) {

    var metadata = files.metadata[i];

    metadata.mime = realMimeRelation[metadata.sha256] || metadata.mime;
  }

  exports.stripExifs(fields, files, callback);

};

exports.validateMimes = function(fields, files, callback, index) {

  if (!validateMimes) {
    return exports.stripExifs(fields, files, callback);
  }

  index = index || 0;

  var file = files.files[index];

  if (!file) {
    return exports.applyRealMimes(fields, files, callback);
  }

  exec('file -b --mime-type ' + file.path, function(error, receivedMime) {

    if (error) {
      callback(error);
    } else {

      file.realMime = receivedMime.trim();

      if (!file.realMime.indexOf('text/')) {
        var actualRealMime = logger.getMime(file.name);

        if (actualRealMime !== 'application/octet-stream') {
          file.realMime = actualRealMime;
        }

      }

      exports.validateMimes(fields, files, callback, ++index);
    }
  });

};

exports.getCheckSums = function(fields, files, callback, index) {

  index = index || 0;

  var file = files.files[index];

  if (!file) {
    return callback();
  }

  logger.sha256(file.path, function(error, sha256) {

    file.sha256 = sha256;
    exports.getCheckSums(fields, files, callback, ++index);

  });

};

exports.getMetaData = function(fields) {

  var fileMetaData = [];

  var spoiled = fields.fileSpoiler || [];
  var sha256 = fields.fileSha256 || [];
  var mime = fields.fileMime || [];
  var name = fields.fileName || [];

  var min = Math.min(spoiled.length, sha256.length);
  min = Math.min(min, mime.length);
  min = Math.min(min, name.length);

  for (var i = 0; i < Math.min(min, fileProcessingLimit); i++) {

    if (!sha256[i] || !mime[i] || !name[i]) {
      continue;
    }

    fileMetaData.push({
      spoiler : spoiled[i],
      sha256 : sha256[i],
      mime : mime[i],
      title : name[i]
    });

  }

  return fileMetaData;

};

exports.getPostData = function(req, res, callback, arrayParams) {

  var parser = formidable({
    uploadDir : uploadDir,
    multiples : true,
    maxFileSize : maxRequestSize
  });

  var filesToDelete = [];
  var files = {};
  var fields = {};

  var endingCb = function() {

    for (var j = 0; j < filesToDelete.length; j++) {
      uploadHandler.removeFromDisk(filesToDelete[j]);
    }

  };

  var json = exports.json(req);

  res.on('close', endingCb);

  res.on('finish', endingCb);

  parser.on('error', function(error) {
    exports.outputError(
        error.code === 'ETOOBIG' ? lang(req.language).errRequestTooBig : error,
        500, res, req.language, json);
  });

  parser.on('field', function(name, value) {

    var array = fields[name] || [];
    fields[name] = array;
    array.push(value);

  });

  parser.on('file', function(name, file) {

    filesToDelete.push(file.path);

    var array = files[name] || [];
    files[name] = array;
    array.push(file);

  });

  parser.on('end', function() {

    files.files = files.files || [];

    if (files.files.length > fileProcessingLimit) {
      files.files.splice(fileProcessingLimit - files.files.length);
    }

    var fileMetaData = exports.getMetaData(fields);

    delete fields.fileSpoiler;
    delete fields.fileMime;
    delete fields.fileSha256;
    delete fields.fileName;

    for ( var key in fields) {

      if (arrayParams && arrayParams.indexOf(key) >= 0) {
        continue;
      }

      if (fields.hasOwnProperty(key)) {
        fields[key] = fields[key][0];
      }
    }

    fields.files = {
      files : files.files,
      metadata : fileMetaData
    };

    // style exception, too simple
    exports.getCheckSums(fields, files, function(error) {

      if (error) {
        exports.outputError(error, 500, res, req.language, json);
      } else {
        callback(exports.getCookies(req), fields);
      }

    });
    // style exception, too simple

  });

  parser.parse(req);

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
    optionalAuth, skipReferer, arrayParams) {

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
    }, arrayParams);
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

  if (useCacheControl) {
    headers.push([ 'cache-control', 'no-cache' ]);
  }

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

exports.dynamicPage = function(res, content, auth) {

  res.writeHead(200, miscOps.getHeader('text/html', auth, useCacheControl ? [ [
      'cache-control', 'no-cache' ] ] : null));
  res.end(content);

};

exports.outputResponse = function(message, redirect, res, cookies, authBlock,
    language, json) {

  if (verbose) {
    console.log(message);
  }

  res.writeHead(200, miscOps.getHeader(json ? 'application/json' : 'text/html',
      authBlock, useCacheControl ? [ [ 'cache-control', 'no-cache' ] ] : null,
      cookies));

  res.end(json ? jsonBuilder.message(message, redirect) : domManipulator
      .message(message, redirect, language));

};

exports.outputError = function(error, code, res, language, json, auth) {

  if (verbose) {
    console.log(error);
  }

  res.writeHead(json ? 200 : code, miscOps.getHeader(json ? 'application/json'
      : 'text/html', auth,
      useCacheControl ? [ [ 'cache-control', 'no-cache' ] ] : null));

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

exports.outputBan = function(ban, bypassable, req, res, json, callback, auth) {

  if ((ban.range || ban.asn) && req.bypassed && bypassable) {
    return callback();
  }

  res.writeHead(200, miscOps.getHeader(json ? 'application/json' : 'text/html',
      auth, useCacheControl ? [ [ 'cache-control', 'no-cache' ] ] : null));

  if (ban.range) {
    ban.range = ban.range.join('.');
  }

  if (json) {

    res.end(jsonBuilder.message('banned', {
      reason : ban.reason,
      asn : ban.asn,
      appealled : !!ban.appeal,
      range : ban.range,
      warning : ban.warning,
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

  if (!ban.warning) {
    return;
  }

  bans.removeOne({
    _id : ban._id
  }, function removed(error) {
    if (verbose) {
      console.log(error);
    }
  });

};

exports.checkForBan = function(req, boardUri, res, cb, auth, json, thread) {

  modOps.ipBan.versatile.checkForBan(req, boardUri, thread, function gotBan(
      error, ban, bypassable) {

    if (bypassable && !req.bypassed) {

      if (json) {

        res.writeHead(200, miscOps.getHeader('application/json', auth,
            useCacheControl ? [ [ 'cache-control', 'no-cache' ] ] : null));
        res.end(jsonBuilder.message('bypassable'));

      } else {

        var headers = [ [ 'Location', '/blockBypass.js' ] ];

        if (useCacheControl) {
          headers.push([ 'cache-control', 'no-cache' ]);
        }

        res.writeHead(302, miscOps.getHeader(null, auth, headers));
        res.end();

      }

    } else if (error) {
      cb(error);
    } else if (ban) {
      exports.outputBan(ban, bypassable, req, res, json, cb, auth);
    } else {
      cb();
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
          : 'text/html', auth, useCacheControl ? [ [ 'cache-control',
          'no-cache' ] ] : null));

      res.end(json ? jsonBuilder.message('hashBan', hashBans) : domManipulator
          .hashBan(hashBans, req.language));
    }
  });

};
