'use strict';

var apiOps = require('../engine/apiOps');
var modOps = require('../engine/modOps').edit;
var mandatoryParameters = [ 'threadId', 'boardUri' ];

function setThreadSettings(userData, parameters, res, auth) {

  if (apiOps.checkBlankParameters(parameters, mandatoryParameters, res)) {
    return;
  }

  modOps.setThreadSettings(userData, parameters, function settingsSet(error) {
    if (error) {
      apiOps.outputError(error, res);
    } else {
      apiOps.outputResponse(auth, null, 'ok', res);
    }
  });
}

exports.process = function(req, res) {

  apiOps.getAuthenticatedData(req, res, function gotData(auth, userData,
      parameters) {

    setThreadSettings(userData, parameters, res, auth);
  });
};