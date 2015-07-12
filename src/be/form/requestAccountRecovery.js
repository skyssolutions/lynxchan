'use strict';

var formOps = require('../engine/formOps');
var lang = require('../engine/langOps').languagePack();
var accountOps = require('../engine/accountOps');

function requestRecovery(parameters, res) {

  if (formOps.checkBlankParameters(parameters, [ 'login' ], res)) {
    return;
  }

  accountOps.requestRecovery(parameters.login, function requestCreated(error) {
    if (error) {
      formOps.outputError(error, 500, res);
    } else {
      formOps.outputResponse(lang.msgRequestCreated, '/login.html', res);
    }
  });

}

exports.process = function(req, res) {

  formOps.getPostData(req, res, function gotData(auth, parameters) {

    requestRecovery(parameters, res);

  });
};