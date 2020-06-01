'use strict';

var formOps = require('../engine/formOps');
var accountOps = require('../engine/accountOps');
var lang = require('../engine/langOps').languagePack;
var mandatoryParameters = [ 'login' ];

exports.createAccount = function(parameters, res, captchaId, language, json) {

  if (formOps.checkBlankParameters(parameters, mandatoryParameters, res,
      language, json)) {
    return;
  }

  accountOps.registerUser(parameters, function userCreated(error, hash,
      expiration) {
    if (error) {
      formOps.outputError(error, 500, res, language, json);
    } else {

      var loginExpiration = new Date();
      loginExpiration.setUTCFullYear(loginExpiration.getUTCFullYear() + 1);

      formOps.outputResponse(json ? 'ok' : lang(language).msgAccountCreated,
          json ? null : '/account.js', res, [ {
            field : 'login',
            value : parameters.login,
            expiration : loginExpiration
          } ], hash ? {
            authStatus : 'expired',
            newHash : hash,
            expiration : expiration
          } : {
            authStatus : 'ok'
          }, language, json);
    }

  }, null, null, captchaId, language);

};

exports.process = function(req, res) {

  formOps.getPostData(req, res, function gotFormData(auth, parameters) {
    exports.createAccount(parameters, res, auth.captchaid, req.language,
        formOps.json(req));
  });

};