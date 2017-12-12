'use strict';

var apiOps = require('../engine/apiOps');
var modOps = require('../engine/modOps').edit;
var mandatoryParameters = [ 'message', 'boardUri' ];

exports.saveEdit = function(auth, parameters, userData, res, language) {

  if (apiOps.checkBlankParameters(parameters, mandatoryParameters, res)) {
    return;
  }

  modOps.saveEdit(userData, parameters, language, function editSaved(error) {
    if (error) {
      apiOps.outputError(error, res);
    } else {
      apiOps.outputResponse(auth, null, 'ok', res);
    }
  });
};

exports.process = function(req, res) {

  apiOps.getAuthenticatedData(req, res, function gotData(auth, userData,
      parameters) {
    exports.saveEdit(auth, parameters, userData, res, req.language);
  });
};