'use strict';

var apiOps = require('../engine/apiOps');
var boardOps = require('../engine/boardOps').rules;
var mandatoryParameters = [ 'boardUri', 'ruleIndex' ];

exports.deleteRule = function(auth, parameters, userData, res, language) {

  if (apiOps.checkBlankParameters(parameters, mandatoryParameters, res)) {
    return;
  }

  boardOps.deleteRule(parameters, userData, language, function ruleDeleted(
      error) {
    if (error) {
      apiOps.outputError(error, res, auth);
    } else {
      apiOps.outputResponse(auth, null, 'ok', res);
    }
  });
};

exports.process = function(req, res) {

  apiOps.getAuthenticatedData(req, res, function gotData(auth, userData,
      parameters) {
    exports.deleteRule(auth, parameters, userData, res, req.language);
  });
};