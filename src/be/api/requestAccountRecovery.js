'use strict';

var apiOps = require('../engine/apiOps');
var accountOps = require('../engine/accountOps');

function recoverAccount(domain, parameters, res) {

  if (apiOps.checkBlankParameters(parameters, [ 'login' ], res)) {
    return;
  }

  accountOps.requestRecovery(domain, parameters.login, function createdRequest(
      error) {
    if (error) {
      apiOps.outputError(error, res);
    } else {
      apiOps.outputResponse(null, null, 'ok', res);
    }
  });
}

exports.process = function(req, res) {

  apiOps.getAnonJsonData(req, res, function gotData(auth, parameters) {
    recoverAccount('http://' + req.headers.host.substring(4), parameters, res);
  });
};