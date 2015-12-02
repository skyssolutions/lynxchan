'use strict';

// Decides what to do with an incoming request and will output errors if they
// are not handled

var indexString = 'index.html';
var url = require('url');
var settings = require('../settingsHandler').getGeneralSettings();
var multiBoardAllowed = settings.multiboardThreadCount;
var multiBoard = require('./multiBoardHandler');
var verbose = settings.verbose;
var maintenance = settings.maintenance;
var archive = require('../archive');
var serveArchive = settings.serveArchive;
var formOps;
var apiOps;
var miscOps;
var gridFs;
var lang;
var staticHandler;

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

exports.processApiRequest = function(req, res) {

  var pathName = url.parse(req.url).pathname;

  if (verbose) {
    console.log('Processing api request: ' + pathName);
  }

  try {
    if (maintenance) {
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

exports.processFormRequest = function(req, res) {

  var pathName = url.parse(req.url).pathname;

  if (verbose) {
    console.log('Processing form request: ' + pathName);
  }

  try {
    if (maintenance) {
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

      require(modulePath).process(req, res);
    }

  } catch (error) {
    formOps.outputError(error, 500, res);
  }

};

exports.getPathNameForGfs = function(req) {
  var pathName = url.parse(req.url).pathname;

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

  for (var i = 0; i < boards.length; i++) {

    var piece = boards[i];

    boardsToReturn.push(piece);

    if (/\W/.test(piece)) {
      return false;
    }
  }

  return true;

};

exports.outputGfsFile = function(req, res) {

  var pathName = exports.getPathNameForGfs(req);

  var splitArray = pathName.split('/');

  var firstPart = splitArray[1];

  var gotSecondString = splitArray.length === 2 && splitArray[1].length;

  var selectedBoards = [];

  if (firstPart.indexOf('.js', firstPart.length - 3) !== -1) {

    exports.processFormRequest(req, res);

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

exports.outputArchiveFile = function(req, res) {

  var pathName = exports.getPathNameForGfs(req);

  var splitArray = pathName.split('/');

  var gotSecondString = splitArray.length === 2 && splitArray[1].length;

  // redirects after cutting the index.html
  if (gotSecondString && !/\W/.test(splitArray[1])) {

    res.writeHead(302, {
      'Location' : '/' + splitArray[1] + '/'

    });
    res.end();
    return;
  }

  if (pathName === '/') {
    try {

      archive.mainArquive(req, res);

    } catch (error) {
      formOps.outputError(error, 500, res);
    }
  } else if (splitArray.length === 3 && !splitArray[2].length) {
    try {

      archive.boardArquive(splitArray[1], req, res);

    } catch (error) {
      formOps.outputError(error, 500, res);
    }
  } else {
    archive.outputFile(pathName, req, res, function streamedFile(error) {
      if (error) {
        exports.outputError(error, res);
      }
    });
  }
};

exports.outputStaticFile = function(req, res) {

  staticHandler.outputFile(req, res, function fileOutput(error) {
    if (error) {
      exports.outputError(error, res);
    }

  });
};

exports.getSubdomain = function(req) {
  var subdomain = req.headers.host.split('.');

  if (subdomain.length > 1) {
    subdomain = subdomain[0];
  } else {
    subdomain = null;
  }

  return subdomain;

};

exports.handle = function(req, res) {

  if (!req.headers || !req.headers.host) {
    res.writeHead(200, miscOps.corsHeader('text/plain'));
    res.end('get fucked, m8 :^)');
    return;
  }

  var subdomain = exports.getSubdomain(req);

  if (subdomain === 'api') {
    exports.processApiRequest(req, res);
  } else if (subdomain === 'static') {
    exports.outputStaticFile(req, res);
  } else if (subdomain === 'archive') {
    if (serveArchive && archive.loaded()) {
      exports.outputArchiveFile(req, res);
    } else if (!serveArchive) {
      formOps.outputError(lang.errNotServingArchives, 500, res);
    } else {
      formOps.outputError(lang.errArchiveNotLoaded, 500, res);
    }

  } else {
    exports.outputGfsFile(req, res);
  }

};