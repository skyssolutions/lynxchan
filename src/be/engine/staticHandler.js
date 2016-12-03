'use strict';

// handles request for static files

var zlib = require('zlib');
var fs = require('fs');
var url = require('url');
var kernel = require('../kernel');
var logger = require('../logger');
var settingsHandler = require('../settingsHandler');
var verbose;
var disable304;
var debug = kernel.debug();
if (!debug) {
  debug = kernel.feDebug();
}
var gridFs;
var miscOps;
var defaultFePath;

var filesCache = {};

exports.loadSettings = function() {

  var settings = settingsHandler.getGeneralSettings();

  defaultFePath = settings.fePath;
  verbose = settings.verbose || settings.verboseStatic;
  disable304 = settings.disable304;
};

exports.loadDependencies = function() {

  gridFs = require('./gridFsHandler');
  miscOps = require('./miscOps');

};

exports.dropCache = function() {
  filesCache = {};
};

// Section 1: File reading {
exports.compress = function(pathName, file, mime, callback) {

  if (!miscOps.isPlainText(mime)) {

    if (!debug) {
      filesCache[pathName] = file;
    }

    callback(null, file);
    return;
  }

  zlib.gzip(file.content, function compressed(error, data) {

    if (error) {
      callback(error);
    } else {

      file.compressed = data;

      if (!debug) {
        filesCache[pathName] = file;
      }

      callback(null, file);

    }

  });

};

exports.getFile = function(finalPath, mime, callback) {

  var file = filesCache[finalPath];

  if (file) {
    callback(null, file);

    return;
  }

  fs.stat(finalPath, function gotStats(error, stats) {
    if (error) {
      callback(error);
    } else {

      // style exception, too simple
      fs.readFile(finalPath, function(error, data) {

        if (error) {
          callback(error);
        } else {

          file = {
            mtime : stats.mtime.toUTCString(),
            content : data
          };

          exports.compress(finalPath, file, mime, callback);
        }

      });
      // style exception, too simple

    }
  });

};
// } Section 1: File reading

// Section 2: File output {
exports.writeFile = function(req, file, mime, res) {

  var header = miscOps.corsHeader(mime).concat(
      [ [ 'last-modified', file.mtime ],
          [ 'expires', new Date().toUTCString() ],
          [ 'Vary', 'Accept-Language' ] ]);

  var outputCompressed = false;

  if (req.language) {
    header.push([ 'Content-Language', req.language.headerValues.join(', ') ]);
  }

  if (file.compressed) {
    header.push([ 'Vary', 'Accept-Encoding' ]);

    if (req.compressed) {
      header.push([ 'Content-Encoding', 'gzip' ]);
      outputCompressed = true;
    }

  }

  res.writeHead(200, header);

  res.end(outputCompressed ? file.compressed : file.content, 'binary');

};

exports.getFilePath = function(req, pathName) {

  var feToUse = req.language ? req.language.frontEnd : defaultFePath;

  return feToUse + '/static' + pathName;

};

exports.outputFile = function(req, pathName, res, callback) {

  if (verbose) {
    console.log('Outputting static file \'' + pathName + '\'');
  }

  var mime = logger.getMime(pathName);

  exports.getFile(exports.getFilePath(req, pathName), mime, function gotFile(
      error, file) {

    if (error) {
      if (debug) {
        console.log(error);
      }

      gridFs.outputFile('/404.html', req, res, callback);
    } else {

      var lastSeen = req.headers ? req.headers['if-modified-since'] : null;

      if (lastSeen === file.mtime && !disable304) {

        if (verbose) {
          console.log('304');
        }

        var header = [ [ 'expires', new Date().toUTCString() ],
            [ 'Vary', 'Accept-Language' ] ];

        if (file.compressed) {
          header.push([ 'Vary', 'Accept-Encoding' ]);
        }

        res.writeHead(304, header);
        res.end();

      } else {
        exports.writeFile(req, file, mime, res);
      }

    }

  });

};
// } Section 2: File output
