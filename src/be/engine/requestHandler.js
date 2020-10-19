'use strict';

// Decides what to do with an incoming request and will output errors if they
// are not handled

var logger = require('../logger');
var kernel = require('../kernel');
var indexString = 'index.html';
var url = require('url');
var proxy = require('http-proxy').createProxyServer({
  secure : false
});
var multiBoardAllowed;
var verbose;
var verboseApis;
var maintenance;
var feDebug = kernel.feDebug();
var db = require('../db');
var langs = db.languages();
var boards = db.boards();
var useLanguages;
var formOps;
var jsonBuilder;
var miscOps;
var gridFs;
var cacheHandler;
var useCacheControl;
var lastSlaveIndex = 0;
var slaves;
var master;
var trustedProxies;
var port;
var masterServePages = [ '/.media', '/.static', '/removeFiles.js',
    '/storeFile.js', '/saveGlobalSettings.js', '/globalSettings.js' ];

proxy.on('proxyReq', function(proxyReq, req, res, options) {
  proxyReq.setHeader('x-forwarded-for', logger.getRawIp(req));
});

exports.formImages = [ '/captcha.js', '/randomBanner.js' ];

exports.loadSettings = function() {

  var settings = require('../settingsHandler').getGeneralSettings();

  useCacheControl = settings.useCacheControl;
  trustedProxies = settings.trustedProxies || [];
  multiBoardAllowed = settings.multiboardThreadCount;
  verbose = settings.verbose || settings.verboseMisc;
  verboseApis = settings.verbose || settings.verboseApis;
  slaves = settings.slaves;
  useLanguages = settings.useAlternativeLanguages;
  master = settings.master;
  maintenance = settings.maintenance && !master;
  port = settings.port;
};

exports.loadDependencies = function() {

  formOps = require('./formOps');
  miscOps = require('./miscOps');
  gridFs = require('./gridFsHandler');
  jsonBuilder = require('./jsonBuilder');
  cacheHandler = require('./cacheHandler');

};

exports.readRangeHeader = function(range, totalLength) {

  if (!range) {
    return null;
  }

  var array = range.split(/bytes=([0-9]*)-([0-9]*)/);
  var start = parseInt(array[1]);
  var end = parseInt(array[2]);

  if (isNaN(start)) {
    start = totalLength - end;
    end = totalLength - 1;
  } else if (isNaN(end)) {
    end = totalLength - 1;
  }

  // limit last-byte-pos to current length
  if (end > totalLength - 1) {
    end = totalLength - 1;
  }

  // invalid or unsatisifiable
  if (isNaN(start) || isNaN(end) || start > end || start < 0) {
    return null;
  }

  return {
    start : start,
    end : end
  };

};

exports.outputError = function(error, res) {

  var header = miscOps.getHeader('text/plain', null, useCacheControl ? [ [
      'cache-control', 'no-cache' ] ] : null);

  if (verbose) {
    console.log(error);
  }

  switch (error.code) {
  case 'ENOENT':
  case 'MODULE_NOT_FOUND':
    res.writeHead(404, header);
    res.write('404');

    break;

  default:
    res.writeHead(500, header);

    res.write('500\n' + error.toString());

    if (!verbose && error.code !== 'EISDIR') {
      console.log(error);
    }

    break;
  }

  res.end();

};

exports.showMaintenance = function(req, pathName, res) {

  if (formOps.json(req)) {

    res.writeHead(200, miscOps.getHeader('application/json', null,
        useCacheControl ? [ [ 'cache-control', 'no-cache' ] ] : null));
    res.end(jsonBuilder.message('maintenance'));

  } else {

    var header = {
      'Location' : exports.formImages.indexOf(pathName) >= 0 ? kernel
          .maintenanceImage() : '/maintenance.html'
    };

    if (useCacheControl) {
      header['cache-control'] = 'no-cache';
    }

    res.writeHead(302, header);
    res.end();

  }

};

exports.runFormProcess = function(pathName, req, res) {

  var modulePath;

  if (pathName.indexOf('/addon.js', 0) !== -1) {
    modulePath = '../form/addon.js';
  } else {
    modulePath = '../form' + pathName;
  }

  if (feDebug) {

    var templateHandler = require('./templateHandler');

    templateHandler.dropAlternativeTemplates();
    templateHandler.loadTemplates();
  }

  require(modulePath).process(req, res);

};

exports.processFormRequest = function(req, pathName, res, callback) {

  if (verboseApis) {
    console.log('Processing form request: ' + pathName);
  }

  try {

    if (maintenance && !req.fromSlave) {
      exports.showMaintenance(req, pathName, res);
    } else {
      exports.runFormProcess(pathName, req, res);
    }

  } catch (error) {

    if (error.code === 'MODULE_NOT_FOUND') {
      gridFs.outputFile('/404.html', req, res, callback);
    } else {
      formOps.outputError(error, 500, res, req.language, formOps.json(req));
    }

  }

};

exports.extractMultiBoard = function(parts) {

  if (parts.length < 2) {
    return false;
  }

  var boards = parts[1].split('+');

  if (boards.length < 2) {
    return false;
  }

  var boardsToPick = [];

  for (var i = 0; i < boards.length; i++) {

    var piece = boards[i];

    if (!piece || /\W/.test(piece)) {
      return false;
    }

    boardsToPick.push(piece);

  }

  return boardsToPick;

};

exports.redirect = function(req, res) {

  var proxyUrl = req.connection.encrypted ? 'https' : 'http';

  proxyUrl += '://';

  proxyUrl += slaves[lastSlaveIndex++];

  if (lastSlaveIndex >= slaves.length) {
    lastSlaveIndex = 0;
  }

  if (!req.connection.encrypted) {
    proxyUrl += ':' + port;
  }

  if (verbose) {
    console.log('Proxying to ' + proxyUrl);
  }

  proxy.web(req, res, {
    target : proxyUrl
  }, function proxyed(error) {

    try {
      exports.outputError(error, res);
    } catch (error) {
      console.log(error);
    }

  });

  return true;

};

exports.checkForService = function(req, pathName, isSlave) {

  if (!slaves.length || isSlave) {
    return true;
  }

  for (var i = 0; i < masterServePages.length; i++) {

    if (!pathName.indexOf(masterServePages[i])) {
      return true;
    }

  }

};

exports.checkForRedirection = function(req, pathName, res) {

  var remote = req.connection.remoteAddress;

  var isSlave = slaves.indexOf(remote) > -1;

  // Is up to the webserver to drop unwanted connections.
  var isLocal = remote === '127.0.0.1' || trustedProxies[0] === '*';
  var isMaster = master === remote;

  if (master) {

    if (!isMaster && !isLocal) {
      req.connection.destroy();
      return true;
    } else {
      req.trustedProxy = true;
      return false;
    }

  } else if (exports.checkForService(req, pathName, isSlave)) {

    req.trustedProxy = isLocal || trustedProxies.indexOf(remote) >= 0;

    req.fromSlave = isSlave;

    return false;

  } else {
    return exports.redirect(req, res);
  }

};

exports.pickFromPossibleLanguages = function(languages, returnedLanguages) {

  for (var i = 0; i < languages.length; i++) {

    for (var j = 0; j < returnedLanguages.length; j++) {

      var returnedLanguage = returnedLanguages[j];

      if (returnedLanguage.headerValues.indexOf(languages[i].language) >= 0) {
        return returnedLanguage;
      }

    }

  }

};

exports.processLanguages = function(languages) {

  var newLanguages = [];

  for (var i = 0; i < languages.length; i++) {

    var element = languages[i];

    element = element.trim();

    if (element.indexOf(';q=') < 0) {

      newLanguages.push({
        language : element,
        priority : 1
      });

    } else {

      var matches = element.match(/([a-zA-Z-]+);q\=([0-9\.]+)/);

      if (!matches) {
        continue;
      }

      newLanguages.push({
        language : matches[1],
        priority : +matches[2]
      });

    }

  }

  return newLanguages;

};

exports.getLanguageToUse = function(req, callback) {

  var languages = req.headers['accept-language'].substring(0, 64).split(',');

  languages = exports.processLanguages(languages);

  languages.sort(function(a, b) {
    return b.priority - a.priority;
  });

  var acceptableLanguages = [];

  for (var i = 0; i < languages.length; i++) {
    acceptableLanguages.push(languages[i].language);
  }

  langs.find({
    headerValues : {
      $in : acceptableLanguages
    }
  }).toArray(
      function gotLanguages(error, returnedLanguages) {

        if (error) {
          callback(error);
        } else if (!returnedLanguages.length) {
          callback();
        } else {
          callback(null, exports.pickFromPossibleLanguages(languages,
              returnedLanguages));
        }

      });

};

exports.routeToFormApi = function(req, pathName, res, firstPart, callback) {

  if (firstPart.length < 4) {
    return false;
  }

  if (firstPart.lastIndexOf('.js') === firstPart.length - 3) {
    exports.processFormRequest(req, pathName, res, callback);
    return true;
  }

};

exports.getCleanPathName = function(pathName) {

  if (!pathName || pathName.length <= indexString.length) {
    return pathName;
  }

  var delta = pathName.length - indexString.length;

  if (pathName.lastIndexOf(indexString) === delta) {
    pathName = pathName.substring(0, pathName.length - indexString.length);
  }

  return pathName;

};

exports.multiBoardsDiff = function(found, toUse) {

  if (found.length !== toUse.length) {
    return true;
  }

  for (var i = 0; i < found.length; i++) {

    if (found[i] !== toUse[i]) {
      return true;
    }

  }

  return false;

};

exports.checkMultiBoardRouting = function(splitArray, req, res, callback) {

  if (!multiBoardAllowed || splitArray.length > 3) {
    callback();
    return;
  }

  if (splitArray.length > 2 && splitArray[2] && splitArray[2] !== '1.json') {
    callback();
    return;
  }

  var boardsToUse = exports.extractMultiBoard(splitArray);

  if (!boardsToUse) {
    callback();
    return;
  }

  boards.aggregate([ {
    $match : {
      boardUri : {
        $in : boardsToUse
      }
    }
  }, {
    $project : {
      boardUri : 1,
      _id : 0
    }
  }, {
    $group : {
      _id : 0,
      boards : {
        $push : '$boardUri'
      }
    }
  } ]).toArray(function gotExistingBoards(error, results) {

    if (error || !results.length) {
      callback(error);
    } else {

      var foundBoards = results[0].boards.sort();

      var diff = exports.multiBoardsDiff(foundBoards, boardsToUse);

      if (diff || splitArray.length === 2) {

        splitArray[1] = foundBoards.join('+');

        if (splitArray.length === 2) {
          splitArray.push('');
        }

        var header = {
          'Location' : splitArray.join('/')
        };

        if (useCacheControl) {
          header['cache-control'] = 'no-cache';
        }

        res.writeHead(302, header);
        res.end();

      } else {
        req.boards = foundBoards;
        callback();
      }

    }

  });

};

exports.decideRouting = function(req, pathName, res, callback) {

  if (pathName.indexOf('/.static/') === 0) {
    cacheHandler.outputFile(pathName, req, res, callback, true);
    return;
  }

  pathName = exports.getCleanPathName(pathName);

  var splitArray = pathName.split('/');

  if (exports.routeToFormApi(req, pathName, res, splitArray[1], callback)) {
    return;
  }

  exports.checkMultiBoardRouting(splitArray, req, res, function checked(error) {

    var gotSecondString = splitArray.length === 2 && splitArray[1];

    if (gotSecondString && !/\W/.test(splitArray[1])) {

      var header = {
        'Location' : '/' + splitArray[1] + '/'
      };

      if (useCacheControl) {
        header['cache-control'] = 'no-cache';
      }

      // redirects if we missed the slash on the board front-page
      res.writeHead(302, header);
      res.end();

    } else {
      cacheHandler.outputFile(pathName, req, res, callback);
    }
  });

};

exports.serve = function(req, pathName, res, callback) {

  if (req.headers['accept-encoding']) {
    req.compressed = req.headers['accept-encoding'].indexOf('gzip') > -1;
  } else {
    req.compressed = false;
  }

  if (req.headers['accept-language'] && useLanguages) {

    exports.getLanguageToUse(req, function gotLanguage(error, language) {

      if (error && verbose) {
        console.log(error);
      }

      req.language = language;

      exports.decideRouting(req, pathName, res, callback);

    });

  } else {
    exports.decideRouting(req, pathName, res, callback);
  }

};

exports.handle = function(req, res) {

  if (!req.headers || !req.headers.host) {
    res.writeHead(200, miscOps.getHeader('text/plain', null,
        useCacheControl ? [ [ 'cache-control', 'no-cache' ] ] : null));
    return res.end('get fucked, m8 :^)');
  }

  var pathName = url.parse(req.url).pathname;

  if (exports.checkForRedirection(req, pathName, res)) {
    return;
  }

  exports.serve(req, pathName, res, function served(error) {

    if (error) {
      exports.outputError(error, res);
    }

  });

};