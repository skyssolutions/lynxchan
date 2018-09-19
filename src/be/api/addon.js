'use strict';

var apiOps = require('../engine/apiOps');
var addonOps = require('../engine/addonOps');
var lang = require('../engine/langOps').languagePack;
var url = require('url');
var settingsHandler = require('../settingsHandler');

exports.process = function(req, res) {

  var requestedAddon = url.parse(req.url).pathname.split('/')[3];
  var loadedAddons = settingsHandler.getGeneralSettings().addons || [];

  requestedAddon = addonOps.aliases[requestedAddon] || requestedAddon;

  if (loadedAddons.indexOf(requestedAddon) === -1) {
    apiOps.outputError(lang(req.language).errUnloadedAddon, res);

  } else {

    require('../addons/' + requestedAddon).apiRequest(req, res);

  }

};