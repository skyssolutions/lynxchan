'use strict';

var apiOps = require('../engine/apiOps');
var settings = require('../settingsHandler').getGeneralSettings();
var genQueue = require('../generationQueue');

function processMessage(req, res, message) {

  if (settings.master || !settings.slaves.length) {

    genQueue.processMessage(message, function generated(error) {

      if (error) {
        apiOps.outputError(error, res);
      } else {
        apiOps.outputResponse(null, null, 'ok', res);
      }

    });

  } else {
    process.send(message);
    apiOps.outputResponse(null, null, 'ok', res);
  }

}

exports.process = function(req, res) {

  // Is up to the reverse proxy to refuse external connections to this page.
  if (!req.fromSlave && !req.trustedProxy) {

    req.connection.destroy();
    return;
  }

  apiOps.getAnonJsonData(req, res, function gotData(auth, parameters) {

    processMessage(req, res, parameters);

  });

};