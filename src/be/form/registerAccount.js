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

  accountOps.registerUser(parameters, function userCreated(error, hash) {
    if (error) {
      formOps.outputError(error, 500, res, language);
    } else {
      formOps.outputResponse(lang(language).msgAccountCreated, '/account.js',
          res, [ {
            field : 'login',
            value : parameters.login
          }, {
            field : 'hash',
            value : hash
          } ], null, language);
    }

  }, null, null, captchaId, language);

}

exports.process = function(req, res) {

  formOps.getPostData(req, res, function gotFormData(auth, parameters) {

    createAccount(parameters, res, auth.captchaid, req.language);

  });

};