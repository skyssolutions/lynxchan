'use strict';

var apiOps = require('../engine/apiOps');
var banOps = require('../engine/modOps').ipBan.specific;
var mandatoryParameters = [ 'ips' ];

function massBan(auth, parameters, userData, language, res) {

  if (apiOps.checkBlankParameters(parameters, mandatoryParameters, res)) {
    return;
  }

  banOps.massBan(userData, parameters, language, function addedAccount(error) {
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

    massBan(auth, parameters, userData, req.language, res);
  });
};