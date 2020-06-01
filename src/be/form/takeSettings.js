'use strict';

var formOps = require('../engine/formOps');
var settingsHandler = require('../settingsHandler');

exports.saveSettings = function(settings, parameters, res, language) {

  parameters.master = settings.master;
  parameters.slaves = [];
  delete parameters.files;

  settingsHandler.setNewSettings(parameters, language, function savedSettings(
      error) {

    if (error) {
      formOps.outputError(error, 500, res, null, true);
    } else {
      formOps.outputResponse('ok', null, res, null, null, null, true);
    }

  });

};

exports.process = function(req, res) {

  var settings = settingsHandler.getGeneralSettings();

  // Is up to the reverse proxy to refuse external connections to this page on a
  // cluster.
  if (!settings.master || !req.trustedProxy) {

    req.connection.destroy();
    return;
  }

  var ended = false;

  var finalData = '';

  req.on('data', function dataReceived(data) {

    if (ended) {
      return;
    }

    finalData += data;

  });

  req.on('end', function dataEnded() {

    ended = true;

    try {
      exports.saveSettings(settings, JSON.parse(finalData), res, req.language);
    } catch (error) {
      formOps.outputError(error, 500, res, null, true);
    }

  });

};