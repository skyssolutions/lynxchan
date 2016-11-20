'use strict';

var formOps = require('../engine/formOps');
var accountOps = require('../engine/accountOps');
var mandatoryParameters = [ 'login' ];
var lang = require('../engine/langOps').languagePack();

function login(res, parameters, language) {

  if (formOps.checkBlankParameters(parameters, mandatoryParameters, res)) {
    return;
  }

  accountOps.login(parameters, function loggedIn(error, hash) {
    if (error) {
      formOps.outputError(error, 500, res, language);
    } else {
      formOps.outputResponse(lang.msgLoginSuccessful, '/account.js', res, [ {
        field : 'login',
        value : parameters.login
      }, {
        field : 'hash',
        value : hash
      } ], null, language);
    }
  });

}

exports.process = function(req, res) {

  formOps.getPostData(req, res, function gotData(auth, parameters) {

    login(res, parameters, req.language);

  });

};