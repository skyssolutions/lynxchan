'use strict';

var apiOps = require('../engine/apiOps');
var modOps = require('../engine/modOps').edit;
var mandatoryParameters = [ 'threadId', 'boardUri' ];

exports.setThreadSettings = function(userData, parameters, res, auth, lang) {

  if (apiOps.checkBlankParameters(parameters, mandatoryParameters, res)) {
    return;
  }

  modOps.setThreadSettings(userData, parameters, lang, function settingsSet(
      error) {
    if (error) {
      apiOps.outputError(error, res, auth);
    } else {
      apiOps.outputResponse(auth, null, 'ok', res);
    }
  });
};

exports.process = function(req, res) {

  apiOps.getAuthenticatedData(req, res, function gotData(auth, userData,
      parameters) {

    exports.setThreadSettings(userData, parameters, res, auth, req.language);
  });
};