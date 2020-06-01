'use strict';

var formOps = require('../engine/formOps');
var accountOps = require('../engine/accountOps');
var languageOps = require('../engine/langOps');
var lang = languageOps.languagePack;
var mandatoryParameters = [ 'login', 'password' ];

exports.addAccount = function(auth, parameters, userData, res, language, json) {

  if (formOps.checkBlankParameters(parameters, mandatoryParameters, res,
      language, json)) {
    return;
  }

  accountOps.addAccount(userData.globalRole, parameters, language,
      function addedAccount(error) {
        if (error) {
          formOps.outputError(error, 500, res, language, json, auth);
        } else {
          formOps.outputResponse(json ? 'ok' : lang(language).msgAccountAdded,
              json ? null : '/accounts.js', res, null, auth, language, json);
        }
      });
};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {
    exports.addAccount(auth, parameters, userData, res, req.language, formOps
        .json(req));
  });
};