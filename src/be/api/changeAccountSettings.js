'use strict';

var apiOps = require('../engine/apiOps');
var accountOps = require('../engine/accountOps');

function setAccountSettings(userData, parameters, res) {

  accountOps.changeSettings(userData, parameters, function settingsChanges(
      error) {
    if (error) {
      apiOps.outputError(error, res);
    } else {
      apiOps.outputResponse(null, null, 'ok', res);
    }
  });

}

exports.process = function(req, res) {

  apiOps.getAuthenticatedData(req, res, function gotData(auth, userData,
      parameters) {

    setAccountSettings(userData, parameters, res);

  });

};