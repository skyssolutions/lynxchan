'use strict';

var formOps = require('../engine/formOps');
var languageOps = require('../engine/langOps');
var lang = languageOps.languagePack;

exports.deleteLanguage = function(auth, parameters, userData, res, language) {

  languageOps.deleteLanguage(userData.globalRole, parameters.languageId,
      language, function deletedLanguage(error) {
        if (error) {
          formOps.outputError(error, 500, res, language);
        } else {
          formOps.outputResponse(lang(language).msgLanguageDeleted,
              '/languages.js', res, null, auth, language);

        }
      });
};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {
    exports.deleteLanguage(auth, parameters, userData, res, req.language);
  });
};