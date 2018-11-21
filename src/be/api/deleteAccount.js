'use strict';

var apiOps = require('../engine/apiOps');
var accountOps = require('../engine/accountOps');
var mandatoryParameters = [ 'account' ];

exports.deleteAccount = function(auth, parameters, userData, language, res) {

  if (apiOps.checkBlankParameters(parameters, mandatoryParameters, res)) {
    return;
  }

  accountOps.deleteAccount(userData, parameters, language,
      function accountDeleted(error) {
        if (error) {
          apiOps.outputError(error, res, auth);
        } else {
          apiOps.outputResponse(auth, null, 'ok', res);
        }
      });
};

exports.process = function(req, res) {

  apiOps.getAuthenticatedData(req, res, function gotData(auth, userData,
      parameters) {

    exports.deleteAccount(auth, parameters, userData, req.language, res);
  });
};