'use strict';

var apiOps = require('../engine/apiOps');
var modOps = require('../engine/modOps');

function setThreadSettings(userData, parameters, res) {

  modOps.setThreadSettings(userData, parameters, function settingsSet(error) {
    if (error) {
      apiOps.outputError(error, res);
    } else {
      apiOps.outputResponse(null, null, 'ok', res);
    }
  });
}

exports.process = function(req, res) {

  apiOps.getAuthenticatedData(req, res, function gotData(auth, userData,
      parameters) {

    setThreadSettings(userData, parameters, res);
  });
};