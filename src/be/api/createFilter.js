'use strict';

var apiOps = require('../engine/apiOps');
var boardOps = require('../engine/boardOps').filters;
var mandatoryParameters = [ 'boardUri', 'originalTerm', 'replacementTerm' ];

exports.createFilter = function(auth, parameters, userData, res, language) {

  if (apiOps.checkBlankParameters(parameters, mandatoryParameters, res)) {
    return;
  }

  boardOps.createFilter(userData, parameters, language, function filterCreated(
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

    exports.createFilter(auth, parameters, userData, res, req.language);
  });
};