'use strict';

// Decides what to do with an incoming request and will output errors if they
// are not handled

var logger = require('../logger');
var indexString = 'index.html';
var url = require('url');
var proxy = require('http-proxy').createProxyServer({
  secure : false
});

proxy.on('proxyReq', function(proxyReq, req, res, options) {
  proxyReq.setHeader('x-forwarded-for', logger.getRawIp(req));
});

var multiBoard = require('./multiBoardHandler');
var multiBoardAllowed;
var verbose;
var maintenance;
var feDebug = require('../kernel').feDebug();
var formOps;
var apiOps;
var miscOps;
var gridFs;
var lang;
var staticHandler;
var lastSlaveIndex = 0;
var slaves;
var master;
var port;

exports.loadSettings = function() {

  var settings = require('../settingsHandler').getGeneralSettings();

  multiBoardAllowed = settings.multiboardThreadCount;
  verbose = settings.verbose;
  slaves = settings.slaves;
  master = settings.master;
  maintenance = settings.maintenance && !master;
  port = settings.port;
};

exports.loadDependencies = function() {

  formOps = require('./formOps');
  apiOps = require('./apiOps');
  miscOps = require('./miscOps');
  gridFs = require('./gridFsHandler');
  lang = require('./langOps').languagePack();
  staticHandler = require('./staticHandler');

};

exports.outputError = function(error, res) {

  var header = miscOps.corsHeader('text/plain');

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

exports.processFormRequest = function(req, pathName, res) {

  if (verbose) {
    console.log('Processing form request: ' + pathName);
  }

  try {
    if (maintenance && !req.fromSlave) {
      gridFs.outputFile('/maintenance.html', req, res, function streamedFile(
          error) {
        if (error) {
          exports.outputError(error, res);
        }
      });
    } else {
      var modulePath;

      if (pathName.indexOf('/addon.js', 0) !== -1) {
        modulePath = '../form/addon.js';
      } else {
        modulePath = '../form' + pathName;
      }

      if (feDebug) {
        require('./templateHandler').loadTemplates();
      }

      require(modulePath).process(req, res);
    }

  } catch (error) {
    formOps.outputError(error, 500, res);
  }

};

exports.getPathNameForGfs = function(pathName) {

  // look at the alias starting from the second character so a board named
  // /alias/ won't return a false negative
  var aliasIndex = pathName.indexOf('/alias/', 1);
  if (aliasIndex > -1) {
    pathName = pathName.substring(0, aliasIndex);
  }

  // these rules are to conform with how the files are saved on gridfs
  if (pathName.length > 1) {

    var delta = pathName.length - indexString.length;

    // if it ends with index.html, strip it
    if (pathName.indexOf(indexString, delta) !== -1) {

      pathName = pathName.substring(0, pathName.length - indexString.length);

    }
  }

  return pathName;
};

exports.testForMultiBoard = function(pathName, boardsToReturn) {

  if (!multiBoardAllowed || maintenance) {
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

  for (var i = 0; i < boards.length; i++) {

    var piece = boards[i];

    boardsToReturn.push(piece);

    if (/\W/.test(piece)) {
      return false;
    }
  }

  return true;

};

exports.outputGfsFile = function(req, pathName, res) {

  pathName = exports.getPathNameForGfs(pathName);

  var splitArray = pathName.split('/');

  var firstPart = splitArray[1];

  var gotSecondString = splitArray.length === 2 && splitArray[1].length;

  var selectedBoards = [];

  if (firstPart.indexOf('.js', firstPart.length - 3) !== -1) {

    exports.processFormRequest(req, pathName, res);

  } else if (gotSecondString && !/\W/.test(splitArray[1])) {

    // redirects if we missed the slash
    res.writeHead(302, {
      'Location' : '/' + splitArray[1] + '/'

    });
    res.end();

  } else if (exports.testForMultiBoard(pathName, selectedBoards)) {

    multiBoard.outputBoards(selectedBoards, req, res, function outputComplete(
        error) {

      if (error) {
        formOps.outputError(error, 500, res);
      }

    });

  } else {

    gridFs.outputFile(pathName, req, res, function streamedFile(error) {
      if (error) {
        exports.outputError(error, res);
      }
    });
  }

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

exports.serve = function(req, pathName, res) {

  if (pathName.indexOf('/.api/') === 0) {
    exports.processApiRequest(req, pathName.substring(5), res);
  } else if (pathName.indexOf('/.static/') === 0) {

    staticHandler.outputFile(req, pathName.substring(8), res,
        function fileOutput(error) {
          if (error) {
            exports.outputError(error, res);
          }

        });

  } else {
    exports.outputGfsFile(req, pathName, res);
  }

};

exports.handle = function(req, res) {

  if (!req.headers || !req.headers.host) {
    res.writeHead(200, miscOps.corsHeader('text/plain'));
    res.end('get fucked, m8 :^)');
    return;
  }

  var pathName = url.parse(req.url).pathname;

  if (exports.checkForRedirection(req, pathName, res)) {
    return;
  } else {
    exports.serve(req, pathName, res);
  }

};