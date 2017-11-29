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
var multiBoard = require('./multiBoardHandler');
var multiBoardAllowed;
var verbose;
var maintenance;
var feDebug = kernel.feDebug();
var debug = kernel.debug();
var langs = require('../db').languages();
var useLanguages;
var formOps;
var apiOps;
var miscOps;
var gridFs;
var staticHandler;
var lastSlaveIndex = 0;
var slaves;
var master;
var port;
proxy.on('proxyReq', function(proxyReq, req, res, options) {
  proxyReq.setHeader('x-forwarded-for', logger.getRawIp(req));
});

var formImages = [ '/captcha.js', '/randomBanner.js' ];

exports.loadSettings = function() {

  var settings = require('../settingsHandler').getGeneralSettings();

  multiBoardAllowed = settings.multiboardThreadCount;
  verbose = settings.verbose || settings.verboseMisc;
  slaves = settings.slaves;
  useLanguages = settings.useAlternativeLanguages;
  master = settings.master;
  maintenance = settings.maintenance && !master;
  port = settings.port;
};

exports.loadDependencies = function() {

  formOps = require('./formOps');
  apiOps = require('./apiOps');
  miscOps = require('./miscOps');
  gridFs = require('./gridFsHandler');
  staticHandler = require('./staticHandler');

};

exports.outputError = function(error, res) {

  var header = miscOps.getHeader('text/plain');

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

exports.processApiRequest = function(req, pathName, res) {

  if (verbose) {
    console.log('Processing api request: ' + pathName);
  }

  try {
    if (maintenance && !req.fromSlave) {
      apiOps.outputResponse(null, null, 'maintenance', res);
    } else {

      var modulePath;

      if (pathName.indexOf('/addon.js', 0) !== -1) {
        modulePath = '../api/addon.js';
      } else {
        modulePath = '../api' + pathName;
      }

      require(modulePath).process(req, res);

    }

  } catch (error) {
    apiOps.outputError(error, res);
  }

};

exports.showMaintenance = function(req, pathName, res) {

  if (formImages.indexOf(pathName) >= 0) {

    res.writeHead(302, {
      'Location' : kernel.maintenanceImage()
    });

    res.end();

  } else {

    gridFs.outputFile('/maintenance.html', req, res, function streamedFile(
        error) {
      if (error) {
        exports.outputError(error, res);
      }
    });
  }

};

exports.processFormRequest = function(req, pathName, res) {

  if (verbose) {
    console.log('Processing form request: ' + pathName);
  }

  try {
    if (maintenance && !req.fromSlave) {
      exports.showMaintenance(req, pathName, res);
    } else {
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
    }

  } catch (error) {
    formOps.outputError(error, 500, res, req.language);
  }

};

exports.extractMultiBoardBoards = function(boards) {

  var boardsToPick = [];

  for (var i = 0; i < boards.length; i++) {

    var piece = boards[i];

    if (/\W/.test(piece)) {
      return false;
    }

    boardsToPick.push(piece);

  }

  return boardsToPick;

};

exports.testForMultiBoard = function(pathName, req, res, callback) {

  if (!multiBoardAllowed) {
    return;
  }

  var parts = pathName.split('/');

  if (parts.length < 2) {
    return false;
  }

  var boards = parts[1].split('+');

  if (boards.length < 2) {
    return false;
  }

  var boardsToPick = exports.extractMultiBoardBoards(boards);

  if (!boardsToPick) {
    return false;
  }

  multiBoard.outputBoards(boardsToPick, req, res, callback);

  return true;

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

  var toGlobalSettings = pathName.indexOf('/globalSettings') === 0;
  var setGlobalSettingsApi = pathName.indexOf('/.api/saveGlobalSettings') === 0;
  var setGlobalSettingsForm = pathName.indexOf('/saveGlobalSettings') === 0;

  var toRet = setGlobalSettingsForm || maintenance || toGlobalSettings;

  return toRet || setGlobalSettingsApi;

};

exports.checkForRedirection = function(req, pathName, res) {

  var remote = req.connection.remoteAddress;

  var isSlave = slaves.indexOf(remote) > -1;

  // Is up to the webserver to drop unwanted connections.
  var isLocal = remote === '127.0.0.1';
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

    req.trustedProxy = isLocal;
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

exports.getLanguageToUse = function(req, callback) {

  var languages = req.headers['accept-language'].substring(0, 64).split(',')
      .map(function(element) {
        element = element.trim();

        if (element.indexOf(';q=') < 0) {
          return {
            language : element,
            priority : 1
          };
        } else {

          var matches = element.match(/([a-zA-Z-]+);q\=([0-9\.]+)/);

          if (!matches) {
            return {
              priority : 0
            };
          }

          return {
            language : matches[1],
            priority : +matches[2]
          };

        }

      });

  languages.sort(function(a, b) {
    return b.priority - a.priority;
  });

  var acceptableLanguages = [];

  for (var i = 0; i < languages.length; i++) {

    var language = languages[i];

    if (language.priority) {
      acceptableLanguages.push(language.language);
    }
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

exports.routeToFormApi = function(req, pathName, res, firstPart) {

  if (firstPart.length < 4) {
    return false;
  }

  if (firstPart.lastIndexOf('.js') === firstPart.length - 3) {
    exports.processFormRequest(req, pathName, res);
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

exports.decideRouting = function(req, pathName, res, callback) {

  if (pathName.indexOf('/.api/') === 0) {
    exports.processApiRequest(req, pathName.substring(5), res);
    return;
  } else if (pathName.indexOf('/.static/') === 0) {
    staticHandler.outputFile(req, pathName.substring(8), res, callback);
    return;
  }

  pathName = exports.getCleanPathName(pathName);

  var splitArray = pathName.split('/');

  if (exports.routeToFormApi(req, pathName, res, splitArray[1])) {
    return;
  }

  var gotSecondString = splitArray.length === 2 && splitArray[1];

  if (gotSecondString && !/\W/.test(splitArray[1])) {

    // redirects if we missed the slash on the board front-page
    res.writeHead(302, {
      'Location' : '/' + splitArray[1] + '/'

    });
    res.end();

  } else if (!exports.testForMultiBoard(pathName, req, res, callback)) {
    gridFs.outputFile(pathName, req, res, callback);
  }

};

exports.serve = function(req, pathName, res, callback) {

  if (req.headers['accept-encoding']) {
    req.compressed = req.headers['accept-encoding'].indexOf('gzip') > -1;
  }

  if (req.headers['accept-language'] && useLanguages) {

    exports.getLanguageToUse(req, function gotLanguage(error, language) {

      if (error) {

        if (debug) {
          throw error;
        } else if (verbose) {
          console.log(error);
        }

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
    res.writeHead(200, miscOps.getHeader('text/plain'));
    res.end('get fucked, m8 :^)');
    return;
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