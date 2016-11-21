'use strict';

var formOps = require('../engine/formOps');
var miscOps = require('../engine/miscOps');
var languageOps = require('../engine/langOps');
var lang = languageOps.languagePack();

function deleteLanguage(auth, parameters, userData, res, language) {

  languageOps.deleteLanguage(userData.globalRole, parameters.languageId,
      function deletedLanguage(error) {
        if (error) {
          formOps.outputError(error, 500, res, language);
        } else {
          formOps.outputResponse(lang.msgLanguageDeleted, '/languages.js', res,
              null, auth, language);

        }
      });
}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {
    deleteLanguage(auth, parameters, userData, res, req.language);
  });
};