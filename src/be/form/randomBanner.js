'use strict';

var url = require('url');
var kernel = require('../kernel');
var defaultBanner = kernel.defaultBanner();
var files = require('../db').files();
var settingsHandler = require('../settingsHandler');
var gridFsHandler = require('../engine/gridFsHandler');
var miscOps = require('../engine/miscOps');
var formOps = require('../engine/formOps');

function outputFile(file, res) {

  res.writeHead(302, {
    'Location' : file

  });
  res.end();

}

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
      formOps.outputError(error, 500, res, req.language);
    } else if (!banners.length) {
      outputFile(defaultBanner, res);
    } else {

      var file = banners[miscOps.getRandomInt(0, banners.length - 1)];
      outputFile(file.filename, res);
    }
  });
};