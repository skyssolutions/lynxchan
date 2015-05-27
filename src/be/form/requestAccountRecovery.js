'use strict';

var formOps = require('../engine/formOps');
var accountOps = require('../engine/accountOps');

function requestRecovery(parameters, res) {

  if (formOps.checkBlankParameters(parameters, [ 'login' ], res)) {
    return;
  }

  accountOps.requestRecovery(parameters.login, function requestCreated(error) {
    if (error) {
      formOps.outputError(error, 500, res);
    } else {
      formOps.outputResponse('Request created, check your e-mail.',
          '/login.html', res);
    }
  });

}

exports.process = function(req, res) {

  formOps.getPostData(req, res, function gotData(auth, parameters) {

    requestRecovery(parameters, res);

  });
};