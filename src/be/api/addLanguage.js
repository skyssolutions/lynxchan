'use strict';

var apiOps = require('../engine/apiOps');
var langOps = require('../engine/langOps');
var mandatoryParameters = [ 'frontEnd', 'languagePack', 'headerValues' ];

function addLanguage(auth, parameters, userData, res) {

  if (apiOps.checkBlankParameters(parameters, mandatoryParameters, res)) {
    return;
  }

  langOps.addLanguage(userData.globalRole, parameters, function addedLanguage(
      error) {
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

    addLanguage(auth, parameters, userData, res);
  });
};