'use strict';

var apiOps = require('../engine/apiOps');
var accountOps = require('../engine/accountOps');
var mandatoryParameters = [ 'login', 'password' ];

function addAccount(auth, parameters, userData, language, res) {

  if (apiOps.checkBlankParameters(parameters, mandatoryParameters, res)) {
    return;
  }

  accountOps.addAccount(userData.globalRole, parameters, language,
      function addedAccount(error) {
        if (error) {
          apiOps.outputError(error, res);
        } else {
          apiOps.outputResponse(auth, null, 'ok', res);
        }
      });
}

exports.process = function(req, res) {

  apiOps.getAuthenticatedData(req, res, function gotData(auth, userData,
      parameters) {

    addAccount(auth, parameters, userData, req.language, res);
  });
};