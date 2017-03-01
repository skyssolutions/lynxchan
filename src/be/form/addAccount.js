'use strict';

var formOps = require('../engine/formOps');
var accountOps = require('../engine/accountOps');
var languageOps = require('../engine/langOps');
var lang = languageOps.languagePack;
var mandatoryParameters = [ 'login', 'password' ];

function addAccount(auth, parameters, userData, res, language) {

  if (formOps.checkBlankParameters(parameters, mandatoryParameters, res,
      language)) {
    return;
  }

  accountOps.addAccount(userData.globalRole, parameters, language,
      function addedAccount(error) {
        if (error) {
          formOps.outputError(error, 500, res, language);
        } else {
          formOps.outputResponse(lang(language).msgAccountAdded,
              '/accounts.js', res, null, auth, language);
        }
      });
}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {
    addAccount(auth, parameters, userData, res, req.language);
  });
};