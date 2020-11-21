'use strict';

var formOps = require('../engine/formOps');
var lang = require('../engine/langOps').languagePack;
var accountOps = require('../engine/accountOps');
var validSettings = accountOps.validAccountSettings;

exports.changeSettings = function(userData, parameters, res, auth, language,
    json) {

  var newSettings = [];

  for (var i = 0; i < validSettings.length; i++) {

    var validSetting = validSettings[i];

    if (parameters[validSetting]) {
      newSettings.push(validSetting);
    }

  }

  parameters.settings = newSettings;

  accountOps.changeSettings(userData, parameters, language,
      function changedSettings(error) {

        if (error) {
          return formOps.outputError(error, 500, res, language, json, auth);
        }

        formOps.outputResponse(json ? 'ok'
            : lang(language).msgAccountSettingsSaved, json ? null
            : '/account.js', res, null, auth, language, json);

      });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {
    exports.changeSettings(userData, parameters, res, auth, req.language,
        formOps.json(req));
  }, null, null, [ 'categoryFilter' ]);

};