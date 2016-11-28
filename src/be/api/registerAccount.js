'use strict';

var apiOps = require('../engine/apiOps');
var accountOps = require('../engine/accountOps');
var mandatoryParameters = [ 'login' ];

function createAccount(parameters, res, captchaId, language) {

  if (apiOps.checkBlankParameters(parameters, mandatoryParameters, res)) {
    return;
  }

  accountOps.registerUser(parameters, function userCreated(error, hash) {
    if (error) {
      apiOps.outputError(error, res);
    } else {
      apiOps.outputResponse(null, hash, 'ok', res);
    }
  }, null, null, captchaId, language);
}

exports.process = function(req, res) {

  apiOps.getAnonJsonData(req, res,
      function gotData(auth, parameters, captchaId) {
        createAccount(parameters, res, captchaId, req.language);
      });
};