'use strict';

var apiOps = require('../engine/apiOps');
var boardOps = require('../engine/boardOps');
var mandatoryParameters = [ 'boardUri', 'originalTerm', 'replacementTerm' ];

function createFilter(parameters, userData, res) {

  if (apiOps.checkBlankParameters(parameters, mandatoryParameters, res)) {
    return;
  }

  boardOps.createFilter(userData.login, parameters, function filterCreated(
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

    createFilter(parameters, userData, res);

  });

};