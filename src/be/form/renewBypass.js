'use strict';

var formOps = require('../engine/formOps');
var bypassOps = require('../engine/bypassOps');
var domManipulator = require('../engine/domManipulator').dynamicPages.miscPages;
var settingsHandler = require('../settingsHandler');
var lang = require('../engine/langOps').languagePack;

function renewBypass(auth, parameters, res, language) {

  bypassOps.renewBypass(auth.captchaid, parameters.captcha, language,
      function renewedBypass(error, bypassId) {

        if (error) {
          formOps.outputError(error, 500, res, language);
        } else {

          formOps.outputResponse(lang(language).msgBypassRenewed,
              '/blockBypass.js', res, [ {
                field : 'bypass',
                value : bypassId,
                path : '/'
              } ], null, language);
        }

      });
}

exports.process = function(req, res) {

  if (!settingsHandler.getGeneralSettings().bypassMode) {
    formOps.outputError(lang(req.language).errDisabledBypass, 500, res,
        req.language);

    return;
  }

  formOps.getPostData(req, res, function gotData(auth, parameters) {
    renewBypass(auth, parameters, res, req.language);
  });

};