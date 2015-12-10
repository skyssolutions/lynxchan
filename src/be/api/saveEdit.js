'use strict';

var apiOps = require('../engine/apiOps');
var modOps = require('../engine/modOps').edit;
var mandatoryParameters = [ 'message' ];

function saveEdit(auth, parameters, userData, res) {

  if (apiOps.checkBlankParameters(parameters, mandatoryParameters, res)) {
    return;
  }

  modOps.saveEdit(userData, parameters, function editSaved(error, filters) {
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
    saveEdit(auth, parameters, userData, res);
  });
};