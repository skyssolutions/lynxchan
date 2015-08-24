'use strict';

var apiOps = require('../engine/apiOps');
var boardOps = require('../engine/boardOps').rules;
var mandatoryParameters = [ 'rule' ];

function addRule(parameters, userData, res) {

  if (apiOps.checkBlankParameters(parameters, mandatoryParameters, res)) {
    return;
  }

  boardOps.addBoardRule(parameters, userData, function ruleAdded(error) {
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

    addRule(parameters, userData, res);
  });
};