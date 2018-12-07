'use strict';

var formOps = require('../engine/formOps');
var languageOps = require('../engine/langOps');
var lang = languageOps.languagePack;
var mandatoryParameters = [ 'frontEnd', 'languagePack', 'headerValues' ];

exports.addLanguage = function(auth, parameters, user, res, language, json) {

  if (formOps.checkBlankParameters(parameters, mandatoryParameters, res,
      language, json)) {
    return;
  }

  parameters.headerValues = parameters.headerValues.split(',').map(
      function(value) {
        return value.trim();
      });

  languageOps.addLanguage(user.globalRole, parameters, language,
      function addedLanguage(error, id) {
        if (error) {
          formOps.outputError(error, 500, res, language, json, auth);
        } else {
          formOps.outputResponse(json ? 'ok' : lang(language).msgLanguageAdded,
              json ? id : '/languages.js', res, null, auth, language, json);

        }
      });
};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {
    exports.addLanguage(auth, parameters, userData, res, req.language, formOps
        .json(req));
  });
};