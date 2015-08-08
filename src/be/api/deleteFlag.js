'use strict';

var apiOps = require('../engine/apiOps');
var boardOps = require('../engine/boardOps');

function deleteFlag(parameters, userData, res) {

  boardOps.deleteFlag(userData.login, parameters.flagId, function deletedFlag(
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
    deleteFlag(parameters, userData, res);
  });
};