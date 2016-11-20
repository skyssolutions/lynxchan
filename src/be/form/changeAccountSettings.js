'use strict';

var formOps = require('../engine/formOps');
var lang = require('../engine/langOps').languagePack();
var accountOps = require('../engine/accountOps');
var validSettings = accountOps.validAccountSettings();

function changeSettings(userData, parameters, res, auth, language) {

  var newSettings = [];

  for (var i = 0; i < validSettings.length; i++) {

    var validSetting = validSettings[i];

    if (parameters[validSetting]) {
      newSettings.push(validSetting);
    }

  }

  parameters.settings = newSettings;

  accountOps.changeSettings(userData, parameters, function changedSettings(
      error) {

    if (error) {
      formOps.outputError(error, 500, res);
    } else {
      formOps.outputResponse(lang.msgAccountSettingsSaved, '/account.js', res,
          null, auth, language);
    }

  });

}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {

    changeSettings(userData, parameters, res, auth, req.language);

  });

};