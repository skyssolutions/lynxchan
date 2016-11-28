'use strict';

var apiOps = require('../engine/apiOps');
var accountOps = require('../engine/accountOps');

function changeSettings(userData, parameters, res, language) {

  accountOps.changePassword(userData, parameters, language,
      function changedPassword(error, newHash) {

        if (error) {
          apiOps.outputError(error, res);
        } else {
          apiOps.outputResponse({
            authStatus : 'expired',
            newHash : newHash
          }, null, 'ok', res);
        }
      });
}

exports.process = function(req, res) {

  apiOps.getAuthenticatedData(req, res, function gotData(auth, userData,
      parameters) {

    changeSettings(userData, parameters, res, req.language);
  });
};