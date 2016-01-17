'use strict';

var apiOps = require('../engine/apiOps');
var settingsHandler = require('../settingsHandler');
var genQueue = require('../generationQueue');

function processMessage(req, res, message, settings) {

  if (settings.master) {

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

  var settings = settingsHandler().getGeneralSettings();

  var standAlone = !settings.master && !settings.slaves.length;

  // Is up to the reverse proxy to refuse external connections to this page on a
  // cluster.
  if (standAlone || (!req.fromSlave && !req.trustedProxy)) {

    req.connection.destroy();
    return;
  }

  apiOps.getAnonJsonData(req, res, function gotData(auth, parameters) {

    processMessage(req, res, parameters, settings);

  });

};