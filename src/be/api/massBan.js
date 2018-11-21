'use strict';

var apiOps = require('../engine/apiOps');
var banOps = require('../engine/modOps').ipBan.specific;
var mandatoryParameters = [ 'ips' ];

exports.massBan = function(auth, parameters, userData, language, res) {

  if (apiOps.checkBlankParameters(parameters, mandatoryParameters, res)) {
    return;
  }

  banOps.massBan(userData, parameters, language, function addedAccount(error) {
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

    exports.massBan(auth, parameters, userData, req.language, res);
  });
};