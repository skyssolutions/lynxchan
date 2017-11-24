'use strict';

var apiOps = require('../engine/apiOps');
var bypassOps = require('../engine/bypassOps');
var settingsHandler = require('../settingsHandler');
var lang = require('../engine/langOps').languagePack;

function renewBypass(parameters, captchaId, res, language) {

  bypassOps.renewBypass(captchaId, parameters.captcha, language,
      function renewedBypass(error, bypass) {

        if (error) {
          apiOps.outputError(error, res);
        } else {

          apiOps.outputResponse(null, {
            id : bypass._id,
            expiration : bypass.expiration
          }, 'ok', res);
        }

      });
}

exports.process = function(req, res) {

  if (!settingsHandler.getGeneralSettings().bypassMode) {
    apiOps.outputError(lang(req.language).errDisabledBypass, res);

    return;
  }

  apiOps.getAnonJsonData(req, res,
      function gotData(auth, parameters, captchaId) {
        renewBypass(parameters, captchaId, res, req.language);
      });

};