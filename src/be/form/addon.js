'use strict';

var formOps = require('../engine/formOps');
var addonOps = require('../engine/addonOps');
var settingsHandler = require('../settingsHandler');
var lang = require('../engine/langOps').languagePack;
var url = require('url');

exports.process = function(req, res) {

  var requestedAddon = url.parse(req.url).pathname.split('/')[2];

  requestedAddon = addonOps.aliases[requestedAddon] || requestedAddon;
  var loadedAddons = settingsHandler.getGeneralSettings().addons || [];

  if (loadedAddons.indexOf(requestedAddon) === -1) {
    formOps.outputError(lang(req.language).errUnloadedAddon, 500, res,
        req.language, formOps.json(req));
  } else {
    require('../addons/' + requestedAddon).formRequest(req, res);
  }

};