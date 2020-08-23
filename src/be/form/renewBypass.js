'use strict';

var formOps = require('../engine/formOps');
var bypassOps = require('../engine/bypassOps');
var settingsHandler = require('../settingsHandler');
var lang = require('../engine/langOps').languagePack;

exports.renewBypass = function(auth, parameters, res, language, json) {

  bypassOps.renewBypass(auth.captchaid, parameters.captcha, language,
      function renewedBypass(error, results, session, salted) {

        if (error) {
          formOps.outputError(error, 500, res, language, json);
        } else {

          var bypass = results.ops[0];

          formOps.outputResponse(json ? 'ok' : lang(language).msgBypassRenewed,
              json ? null : '/blockBypass.js', res, [ {
                field : 'bypass',
                value : bypass._id + session + (salted || ''),
                path : '/',
                expiration : bypass.expiration
              } ], null, language, json);
        }

      });
};

exports.process = function(req, res) {

  var json = formOps.json(req);

  if (!settingsHandler.getGeneralSettings().bypassMode) {

    formOps.outputError(lang(req.language).errDisabledBypass, 500, res,
        req.language, json);

    return;
  }

  formOps.getPostData(req, res, function gotData(auth, parameters) {
    exports.renewBypass(auth, parameters, res, req.language, json);
  });

};