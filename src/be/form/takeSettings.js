'use strict';

var apiOps = require('../engine/apiOps');
var settingsHandler = require('../settingsHandler');
var settingsHandler = require('../settingsHandler');

function saveSettings(settings, parameters, res) {

  parameters.master = settings.master;
  parameters.slaves = [];
  delete parameters.files;

  settingsHandler.setNewSettings(parameters, function savedSettings(error) {

    if (error) {
      apiOps.outputError(error, res);
    } else {
      apiOps.outputResponse(null, null, 'ok', res);
    }

  });

}

exports.process = function(req, res) {

  var settings = settingsHandler.getGeneralSettings();

  // Is up to the reverse proxy to refuse external connections to this page on a
  // cluster.
  if (!settings.master || !req.trustedProxy) {

    req.connection.destroy();
    return;
  }

  apiOps.getAnonJsonData(req, res, function gotData(auth, parameters) {

    saveSettings(settings, parameters, res);

  });

};