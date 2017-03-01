'use strict';

var apiOps = require('../engine/apiOps');
var langOps = require('../engine/langOps');

function deleteLanguage(auth, parameters, userData, language, res) {

  langOps.deleteLanguage(userData.globalRole, parameters.languageId, language,
      function deletedLanguage(error) {
        if (error) {
          apiOps.outputError(error, res);
        } else {
          apiOps.outputResponse(auth, null, 'ok', res);
        }
      });
}

exports.process = function(req, res) {

  apiOps.getAuthenticatedData(req, res, function gotData(auth, userData,
      parameters) {

    deleteLanguage(auth, parameters, userData, req.language, res);
  });
};