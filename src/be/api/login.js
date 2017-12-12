'use strict';

var apiOps = require('../engine/apiOps');
var accountOps = require('../engine/accountOps');
var mandatoryParameters = [ 'login' ];

exports.login = function(parameters, res, language) {

  if (apiOps.checkBlankParameters(parameters, mandatoryParameters, res)) {
    return;
  }

  accountOps.login(parameters, language, function loggedIn(error, hash,
      expiration) {

    if (error) {
      apiOps.outputError(error, res);
    } else {
      apiOps.outputResponse({
        newHash : hash,
        expiration : expiration,
        authStatus : 'expired'
      }, null, 'ok', res);
    }
  });
};

exports.process = function(req, res) {

  apiOps.getAnonJsonData(req, res, function gotData(auth, parameters) {
    exports.login(parameters, res, req.language);
  });
};