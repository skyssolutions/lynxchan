'use strict';

var formOps = require('../engine/formOps');
var miscOps = require('../engine/miscOps');
var lang = require('../engine/langOps').languagePack();
var languageOps = require('../engine/langOps');
var mandatoryParameters = [ 'frontEnd', 'languagePack', 'headerValues' ];

function addLanguage(auth, parameters, userData, res) {

  if (formOps.checkBlankParameters(parameters, mandatoryParameters, res)) {
    return;
  }

  parameters.headerValues = parameters.headerValues.split(',').map(
      function(value) {
        return value.trim();
      });

  languageOps.addLanguage(userData.globalRole, parameters,
      function addedLanguage(error) {
        if (error) {
          formOps.outputError(error, 500, res);
        } else {
          formOps.outputResponse(lang.msgLanguageAdded, '/languages.js', res,
              null, auth);

        }
      });
}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {
    addLanguage(auth, parameters, userData, res);
  });
};