'use strict';

var formOps = require('../engine/formOps');
var accountOps = require('../engine/accountOps');
var lang = require('../engine/langOps').languagePack;
var mandatoryParameters = [ 'login' ];

function createAccount(parameters, res, captchaId, language) {

  if (formOps.checkBlankParameters(parameters, mandatoryParameters, res,
      language)) {
    return;
  }

  accountOps.registerUser(parameters, function userCreated(error, hash,
      expiration) {
    if (error) {
      formOps.outputError(error, 500, res, language);
    } else {

      var loginExpiration = new Date();
      loginExpiration.setUTCFullYear(loginExpiration.getUTCFullYear() + 1);

      formOps.outputResponse(lang(language).msgAccountCreated, '/account.js',
          res, [ {
            field : 'login',
            value : parameters.login,
            expiration : loginExpiration
          } ], {
            authStatus : 'expired',
            newHash : hash,
            expiration : expiration
          }, language);
    }

  }, null, null, captchaId, language);

}

exports.process = function(req, res) {

  formOps.getPostData(req, res, function gotFormData(auth, parameters) {

    createAccount(parameters, res, auth.captchaid, req.language);

  });

};