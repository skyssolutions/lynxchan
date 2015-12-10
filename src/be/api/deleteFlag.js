'use strict';

var apiOps = require('../engine/apiOps');
var boardOps = require('../engine/boardOps').flags;

function deleteFlag(auth, parameters, userData, res) {

  boardOps.deleteFlag(userData, parameters.flagId, function deletedFlag(error) {
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
    deleteFlag(auth, parameters, userData, res);
  });
};