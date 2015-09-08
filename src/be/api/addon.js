'use strict';

var apiOps = require('../engine/apiOps');
var loadedAddons = require('../boot').getGeneralSettings().addons || [];
var lang = require('../engine/langOps').languagePack();
var url = require('url');

exports.process = function(req, res) {

  var requestedAddon = url.parse(req.url).pathname.split('/')[2];

  if (loadedAddons.indexOf(requestedAddon) === -1) {
    apiOps.outputError(lang.errUnloadedAddon, res);

  } else {

    require('../addons/' + requestedAddon).apiRequest(req, res);

  }

};