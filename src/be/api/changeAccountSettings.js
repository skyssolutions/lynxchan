'use strict';

var apiOps = require('../engine/apiOps');
var accountOps = require('../engine/accountOps');
var validSettings = accountOps.validAccountSettings;

exports.setAccountSettings = function(userData, parameters, res, auth) {

  var desiredSettings = parameters.settings || [];

  var newSettings = [];

  for (var i = 0; i < validSettings.length; i++) {
    var setting = desiredSettings[i];

    if (validSettings.indexOf(setting) > -1) {
      newSettings.push(setting);
    }
  }

  parameters.settings = newSettings;

  accountOps.changeSettings(userData, parameters, function settingsChanges(
      error) {
    if (error) {
      apiOps.outputError(error, res);
    } else {
      apiOps.outputResponse(auth, null, 'ok', res);
    }
  });

};

exports.process = function(req, res) {

  apiOps.getAuthenticatedData(req, res, function gotData(auth, userData,
      parameters) {
    exports.setAccountSettings(userData, parameters, res, auth);
  });

};