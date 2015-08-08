'use strict';

var apiOps = require('../engine/apiOps');
var boardOps = require('../engine/boardOps');

function deleteRule(parameters, userData, res) {

  boardOps.deleteRule(parameters, userData, function ruleDeleted(error) {
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
    deleteRule(parameters, userData, res);
  });
};