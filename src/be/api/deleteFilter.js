'use strict';

var apiOps = require('../engine/apiOps');
var boardOps = require('../engine/boardOps').filters;
var mandatoryParameters = [ 'boardUri', 'filterIdentifier' ];

function deleteFilter(auth, parameters, userData, res, language) {

  if (apiOps.checkBlankParameters(parameters, mandatoryParameters, res)) {
    return;
  }

  boardOps.deleteFilter(userData, parameters, language, function filterDeleted(
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

    deleteFilter(auth, parameters, userData, res, req.language);
  });
};