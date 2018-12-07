'use strict';

var formOps = require('../engine/formOps');
var languageOps = require('../engine/langOps');
var lang = languageOps.languagePack;

exports.deleteLanguage = function(auth, parameters, userData, res, language,
    json) {

  languageOps.deleteLanguage(userData.globalRole, parameters.languageId,
      language, function deletedLanguage(error) {
        if (error) {
          formOps.outputError(error, 500, res, language, json, auth);
        } else {
          formOps.outputResponse(json ? 'ok'
              : lang(language).msgLanguageDeleted, json ? null
              : '/languages.js', res, null, auth, language, json);

        }
      });
};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {
    exports.deleteLanguage(auth, parameters, userData, res, req.language,
        formOps.json(req));
  });
};