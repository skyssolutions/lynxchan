'use strict';

var apiOps = require('../engine/apiOps');
var lang = require('../engine/langOps').languagePack();
var url = require('url');
var settingsHandler = require('../settingsHandler');

exports.process = function(req, res) {

  var requestedAddon = url.parse(req.url).pathname.split('/')[3];
  var loadedAddons = settingsHandler.getGeneralSettings().addons || [];

  if (loadedAddons.indexOf(requestedAddon) === -1) {
    apiOps.outputError(lang.errUnloadedAddon, res);

  } else {

    require('../addons/' + requestedAddon).apiRequest(req, res);

  }

};