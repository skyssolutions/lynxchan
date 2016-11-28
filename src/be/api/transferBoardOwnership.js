'use strict';

var apiOps = require('../engine/apiOps');
var boardOps = require('../engine/boardOps').meta;
var mandatoryParameters = [ 'boardUri', 'login' ];

function setVolunteer(auth, userData, parameters, res, language) {

  if (apiOps.checkBlankParameters(parameters, mandatoryParameters, res)) {
    return;
  }

  boardOps.transfer(userData, parameters, language, function transfered(error) {

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
    setVolunteer(auth, userData, parameters, res, req.language);
  });
};