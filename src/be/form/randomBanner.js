'use strict';

var url = require('url');
var boot = require('../boot');
var defaultBanner = boot.defaultBanner();
var files = require('../db').files();
var settings = require('../settingsHandler').getGeneralSettings();
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

  var overboard = parameters.boardUri === settings.overboard;
  var multiBoard = parameters.boardUri === '.multiBoard';
  var global = overboard || multiBoard || settings.useGlobalBanners;
  

  files.find({
    'metadata.boardUri' : global ? {
      $exists : false
    } : parameters.boardUri,
    'metadata.type' : 'banner'
  }).toArray(function(error, banners) {
    if (error) {
      formOps.outputError(error, 500, res);
    } else if (!banners.length) {
      outputFile(defaultBanner, res);
    } else {

      var file = banners[miscOps.getRandomInt(0, banners.length - 1)];
      outputFile(file.filename, res);
    }
  });
};