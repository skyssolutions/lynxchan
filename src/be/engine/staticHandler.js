'use strict';

// handles request for static files

var boot = require('../boot');
var fePath = boot.getFePath();
var verbose = boot.getGeneralSettings().verbose;
var disable304 = boot.getGeneralSettings().disable304;
var debug = boot.debug();
var fs = require('fs');
var url = require('url');
var gridFs;
var miscOps;

var filesCache = {};

exports.loadDependencies = function() {

  gridFs = require('./gridFsHandler');
  miscOps = require('./miscOps');

};

function respond(fileContent, header, res) {

  res.writeHead(200, header);

  res.end(fileContent, 'binary');

}

function readAndRespond(pathName, modifiedTime, header, res, callback) {

  header.push([ 'last-modified', modifiedTime.toString() ]);
  header.push([ 'expires', new Date().toString() ]);

  fs.readFile(fePath + '/static' + pathName, function(error, data) {

    if (error) {
      callback(error);
      return;
    }

    var file = {
      mtime : modifiedTime,
      content : data
    };

    if (!debug) {
      filesCache[pathName] = file;
    }

    respond(data, header, res);

  });
}

// reads file stats to find out if theres a new version
function readFileStats(pathName, lastSeen, header, req, res, callback) {

  fs.stat(boot.getFePath() + '/static' + pathName, function gotStats(error,
      stats) {
    if (error) {
      if (debug) {
        console.log(error);
      }

      gridFs.outputFile('/404.html', req, res, callback);

    } else if (lastSeen === stats.mtime.toString() && !disable304) {
      if (verbose) {
        console.log('304');
      }

      res.writeHead(304);
      res.end();
    } else {
      readAndRespond(pathName, stats.mtime, header, res, callback);
    }
  });

}

exports.outputFile = function(req, res, callback) {

  var lastSeen = req.headers ? req.headers['if-modified-since'] : null;

  var pathName = url.parse(req.url).pathname;

  if (verbose) {
    console.log('Outputting static file \'' + pathName + '\'');
  }

  var header = miscOps.corsHeader(miscOps.getMime(pathName));

  var file;

  if (!debug) {
    file = filesCache[pathName];
  }

  if (!file) {
    readFileStats(pathName, lastSeen, header, req, res, callback);
  } else if (lastSeen === file.mtime.toString() && !disable304) {

    if (verbose) {
      console.log('304');

    }

    res.writeHead(304);
    res.end();

  } else {
    respond(file.content, header, res);
  }

};