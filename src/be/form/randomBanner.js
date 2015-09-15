'use strict';

var url = require('url');
var boot = require('../boot');
var defaultBanner = boot.defaultBanner();
var files = require('../db').files();
var settings = require('../settingsHandler').getGeneralSettings();
var gridFsHandler = require('../engine/gridFsHandler');
var miscOps = require('../engine/miscOps');
var formOps = require('../engine/formOps');

function outputFile(file, req, res) {

  gridFsHandler.outputFile(file, req, res, function streamed(error) {
    if (error) {
      formOps.outputError(error, 500, res);
    }
  });

}

exports.process = function(req, res) {

  var parameters = url.parse(req.url, true).query;

  files.find({
    'metadata.boardUri' : settings.useGlobalBanners ? {
      $exists : false
    } : parameters.boardUri,
    'metadata.type' : 'banner'
  }).toArray(function(error, banners) {
    if (error) {
      formOps.outputError(error, 500, res);
    } else if (!banners.length) {
      outputFile(defaultBanner, req, res);
    } else {

      var file = banners[miscOps.getRandomInt(0, banners.length - 1)];
      outputFile(file.filename, req, res);
    }
  });
};