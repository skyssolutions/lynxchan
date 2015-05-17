'use strict';

// decides what to do with an incoming request and will output errors if they
// are not handled

var indexString = 'index.html';
var url = require('url');
var miscOps = require('./miscOps');
var debug = process.argv.toString().indexOf('debug') > -1;
var gridFs = require('./gridFsHandler');

function outputError(error, res) {

  var header = miscOps.corsHeader('text/plain');

  if (debug) {
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

    if (!debug) {
      console.log(error);
    }

    break;
  }

  res.end();

}

function outputGfsFile(req, res) {

  var pathName = url.parse(req.url).pathname;

  if (pathName.length > 1) {

    var delta = pathName.length - indexString.length;

    if (pathName.indexOf(indexString, delta) !== -1) {

      pathName = pathName.substring(0, pathName.length - indexString.length);

    } else if (pathName.indexOf('/', pathName.length - 1) !== -1) {
      pathName += '/';
    }
  }

  gridFs.outputFile(pathName, req, res, function streamedFile(error) {
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

  // TODO
  if (subdomain.length && subdomain[0] === 'api') {
    req.connection.destroy();
  } else if (subdomain.length && subdomain[0] === 'form') {
    req.connection.destroy();
  } else if (subdomain.length && subdomain[0] === 'media') {
    req.connection.destroy();
  } else {

    outputGfsFile(req, res);

  }
};