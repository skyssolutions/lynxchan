'use strict';

var formOps = require('../engine/formOps');
var bypassOps = require('../engine/bypassOps');
var lang = require('../engine/langOps').languagePack;
var mandatoryParams = [ 'code' ];

exports.validateBypass = function(auth, parameters, res, language, json) {

  if (formOps.checkBlankParameters(parameters, mandatoryParams, res, language,
      json)) {
    return;
  }

  bypassOps.validateBypass(auth.bypass, parameters.code.trim(), language,
      function(error, bypassData) {

        if (error) {
          return formOps.outputError(error, 500, res, language, json);
        }

        formOps.outputResponse(json ? 'ok' : lang(language).msgBypassValidated,
            json ? null : '/blockBypass.js', res, [ {
              field : 'bypass',
              value : bypassData._id + bypassData.session,
              path : '/',
              expiration : bypassData.expiration
            } ], null, language, json);

      });
};

exports.process = function(req, res) {

  var json = formOps.json(req);

  formOps.getPostData(req, res, function gotData(auth, parameters) {
    exports.validateBypass(auth, parameters, res, req.language, json);
  });

};