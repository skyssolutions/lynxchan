'use strict';

var formOps = require('../engine/formOps');
var accountOps = require('../engine/accountOps');
var mandatoryParameters = [ 'login' ];
var lang = require('../engine/langOps').languagePack;

exports.login = function(req, res, parameters, language, json) {

  if (formOps.checkBlankParameters(parameters, mandatoryParameters, res,
      language, json)) {
    return;
  }

  accountOps.login(parameters, language, function loggedIn(error, hash,
      expiration) {
    if (error) {
      formOps.outputError(error, 500, res, language, json);
    } else {

      var loginExpiration = new Date();
      loginExpiration.setUTCFullYear(loginExpiration.getUTCFullYear() + 1);

      formOps.outputResponse(json ? 'ok' : lang(language).msgLoginSuccessful,
          json ? null : formOps.getCookies(req).loginredirect || '/account.js',
          res, [ {
            field : 'login',
            value : parameters.login,
            expiration : loginExpiration
          }, {
            field : 'loginredirect',
            value : '',
            expiration : new Date()
          } ], hash ? {
            authStatus : 'expired',
            newHash : hash,
            expiration : expiration
          } : {
            authStatus : 'ok'
          }, language, json);
    }
  });

};

exports.process = function(req, res) {

  formOps.getPostData(req, res, function gotData(auth, parameters) {
    exports.login(req, res, parameters, req.language, formOps.json(req));
  });

};