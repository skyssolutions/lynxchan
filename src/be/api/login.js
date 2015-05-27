'use strict';

var apiOps = require('../engine/apiOps');
var accountOps = require('../engine/accountOps');
var mandatoryParameters = [ 'login', 'password' ];

function login(parameters, res) {

  if (apiOps.checkBlankParameters(parameters, mandatoryParameters, res)) {
    return;
  }

  accountOps.login(parameters, function loggedIn(error, hash) {

    if (error) {
      apiOps.outputError(error, res);
    } else {
      apiOps.outputResponse(null, hash, 'ok', res);
    }

  });
}

exports.process = function(req, res) {

  apiOps.getAnonJsonData(req, res, function gotData(auth, parameters) {

    login(parameters, res);

  });

};