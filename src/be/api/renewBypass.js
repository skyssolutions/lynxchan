'use strict';

var apiOps = require('../engine/apiOps');
var bypassOps = require('../engine/bypassOps');
var settingsHandler = require('../settingsHandler');
var lang = require('../engine/langOps').languagePack();

function renewBypass(parameters, captchaId, res) {

  bypassOps.renewBypass(captchaId, parameters.captcha, function renewedBypass(
      error, bypassId) {

    if (error) {
      apiOps.outputError(error, res);
    } else {

      apiOps.outputResponse(null, bypassId, 'ok', res);
    }

  });
}

exports.process = function(req, res) {

  if (!settingsHandler.getGeneralSettings().bypassMode) {
    apiOps.outputError(lang.errDisabledBypass, res);

    return;
  }

  apiOps.getAnonJsonData(req, res,
      function gotData(auth, parameters, captchaId) {
        renewBypass(parameters, captchaId, res);
      });

};