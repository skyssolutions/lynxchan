'use strict';

var url = require('url');
var kernel = require('../kernel');
var defaultBanner = kernel.defaultBanner();
var files = require('../db').files();
var settingsHandler = require('../settingsHandler');
var gridFsHandler = require('../engine/gridFsHandler');
var miscOps = require('../engine/miscOps');
var formOps = require('../engine/formOps');

exports.outputFile = function(file, res) {

  var headers = {
    'Location' : file,
  };

  if (settingsHandler.getGeneralSettings.useCacheControl) {
    headers['Cache-control'] = 'no-cache';
  }

  res.writeHead(302, headers);
  res.end();

};

exports.process = function(req, res) {

  var parameters = url.parse(req.url, true).query;

  var useGlobal = settingsHandler.getGeneralSettings().useGlobalBanners;

  var global = !parameters.boardUri || useGlobal;

  files.find({
    'metadata.boardUri' : global ? {
      $exists : false
    } : parameters.boardUri,
    'metadata.type' : 'banner'
  }).toArray(function(error, banners) {
    if (error) {
      formOps.outputError(error, 500, res, req.language, parameters.json);
    } else if (!banners.length) {
      exports.outputFile(defaultBanner, res);
    } else {

      var file = banners[miscOps.getRandomInt(0, banners.length - 1)];
      exports.outputFile(file.filename, res);
    }
  });

};