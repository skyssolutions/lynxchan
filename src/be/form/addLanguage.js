'use strict';

var formOps = require('../engine/formOps');
var languageOps = require('../engine/langOps');
var lang = languageOps.languagePack;
var mandatoryParameters = [ 'frontEnd', 'languagePack', 'headerValues' ];

function addLanguage(auth, parameters, userData, res, language) {

  if (formOps.checkBlankParameters(parameters, mandatoryParameters, res,
      language)) {
    return;
  }

  parameters.headerValues = parameters.headerValues.split(',').map(
      function(value) {
        return value.trim();
      });

  languageOps.addLanguage(userData.globalRole, parameters, language,
      function addedLanguage(error) {
        if (error) {
          formOps.outputError(error, 500, res, language);
        } else {
          formOps.outputResponse(lang(language).msgLanguageAdded,
              '/languages.js', res, null, auth, language);

        }
      });
}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {
    addLanguage(auth, parameters, userData, res, req.language);
  });
};