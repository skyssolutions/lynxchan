'use strict';

var formOps = require('../engine/formOps');
var accountOps = require('../engine/accountOps');
var mandatoryParameters = [ 'login' ];
var lang = require('../engine/langOps').languagePack;

exports.login = function(res, parameters, language) {

  if (formOps.checkBlankParameters(parameters, mandatoryParameters, res,
      language)) {
    return;
  }

  accountOps.login(parameters, language, function loggedIn(error, hash,
      expiration) {
    if (error) {
      formOps.outputError(error, 500, res, language);
    } else {

      var loginExpiration = new Date();
      loginExpiration.setUTCFullYear(loginExpiration.getUTCFullYear() + 1);

      formOps.outputResponse(lang(language).msgLoginSuccessful, '/account.js',
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
  });

};

exports.process = function(req, res) {

  formOps.getPostData(req, res, function gotData(auth, parameters) {
    exports.login(res, parameters, req.language);
  });

};