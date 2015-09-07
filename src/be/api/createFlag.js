'use strict';

var apiOps = require('../engine/apiOps');
var boardOps = require('../engine/boardOps').flags;
var mandatoryParameters = [ 'flagName' ];

function createFlag(parameters, userData, res) {

  if (apiOps.checkBlankParameters(parameters, mandatoryParameters, res)) {
    return;
  }

  boardOps.createFlag(userData, parameters, function createdFlag(error) {
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

    createFlag(parameters, userData, res);
  });
};