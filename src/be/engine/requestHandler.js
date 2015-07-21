'use strict';

// decides what to do with an incoming request and will output errors if they
// are not handled

var indexString = 'index.html';
var url = require('url');
var formOps = require('./formOps');
var apiOps = require('./apiOps');
var miscOps = require('./miscOps');
var verbose = require('../boot').getGeneralSettings().verbose;
var gridFs = require('./gridFsHandler');
var staticHandler = require('./staticHandler');
var debug = require('../boot').debug();

function outputError(error, res) {

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

    if (!verbose) {
      console.log(error);
    }

    break;
  }

  res.end();

}

function processApiRequest(req, res) {

  var pathName = url.parse(req.url).pathname;

  if (verbose) {
    console.log('Processing api request: ' + pathName);
  }

  try {
    if (debug) {
      var module = require.resolve('../api' + pathName);
      delete require.cache[module];
    }

    require('../api' + pathName).process(req, res);

  } catch (error) {
    apiOps.outputError(error, res);
  }

}

function processFormRequest(req, res) {

  var pathName = url.parse(req.url).pathname;

  if (verbose) {
    console.log('Processing form request: ' + pathName);
  }

  try {
    if (debug) {
      var module = require.resolve('../form' + pathName);
      delete require.cache[module];
    }

    require('../form' + pathName).process(req, res);

  } catch (error) {
    formOps.outputError(error, 500, res);
  }

}

function getPathNameForGfs(req) {
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
}

function outputGfsFile(req, res) {

  var pathName = getPathNameForGfs(req);

  var splitArray = pathName.split('/');

  var gotSecondString = splitArray.length === 2 && splitArray[1].length;

  if (pathName.indexOf('.js', pathName.length - 3) !== -1) {

    processFormRequest(req, res);

    return;
  } else

  // redirects after cutting the index.html
  if (gotSecondString && !/\W/.test(splitArray[1])) {

    res.writeHead(302, {
      'Location' : '/' + splitArray[1] + '/'

    });
    res.end();
    return;
  }

  gridFs.outputFile(pathName, req, res, function streamedFile(error) {
    if (error) {
      outputError(error, res);
    }
  });

}

function outputStaticFile(req, res) {

  staticHandler.outputFile(req, res, function fileOutput(error) {
    if (error) {
      outputError(error, res);
    }

  });
}

exports.handle = function(req, res) {

  if (!req.headers || !req.headers.host) {
    res.writeHead(200, miscOps.corsHeader('text/plain'));
    res.end('get fucked, m8 :^)');
    return;
  }

  var subdomain = req.headers.host.split('.');

  if (subdomain.length && subdomain[0] === 'api') {
    processApiRequest(req, res);
  } else if (subdomain.length && subdomain[0] === 'static') {
    outputStaticFile(req, res);
  } else {
    outputGfsFile(req, res);

  }
};