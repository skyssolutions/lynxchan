'use strict';

var apiOps = require('../engine/apiOps');
var accountOps = require('../engine/accountOps');
var mandatoryParameters = [ 'login' ];

function login(parameters, res, language) {

  if (apiOps.checkBlankParameters(parameters, mandatoryParameters, res)) {
    return;
  }

  accountOps.login(parameters, language, function loggedIn(error, hash) {

    if (error) {
      apiOps.outputError(error, res);
    } else {
      apiOps.outputResponse(null, hash, 'ok', res);
    }
  });
}

exports.process = function(req, res) {

  apiOps.getAnonJsonData(req, res, function gotData(auth, parameters) {
    login(parameters, res, req.language);
  });
};