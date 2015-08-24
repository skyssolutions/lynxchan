'use strict';

var apiOps = require('../engine/apiOps');
var boardOps = require('../engine/boardOps').filters;
var mandatoryParameters = [ 'boardUri', 'filterIdentifier' ];

function deleteFilter(parameters, userData, res) {

  if (apiOps.checkBlankParameters(parameters, mandatoryParameters, res)) {
    return;
  }

  boardOps.deleteFilter(userData.login, parameters, function filterDeleted(
      error) {
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

    deleteFilter(parameters, userData, res);
  });
};