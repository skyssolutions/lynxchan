'use strict';

var formOps = require('../engine/formOps');
var accountOps = require('../engine/accountOps');
var languageOps = require('../engine/langOps');
var lang = languageOps.languagePack;
var mandatoryParameters = [ 'account' ];

exports.deleteAccount = function(auth, parameters, userData, res, language,
    json) {

  if (formOps.checkBlankParameters(parameters, mandatoryParameters, res,
      language, json)) {
    return;
  }

  accountOps.deleteAccount(userData, parameters, language,
      function accountDeleted(error) {
        if (error) {
          formOps.outputError(error, 500, res, language, json, auth);
        } else {
          formOps.outputResponse(
              json ? 'ok' : lang(language).msgAccountDeleted, json ? null
                  : '/accounts.js', res, null, auth, language, json);
        }
      });
};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {
    exports.deleteAccount(auth, parameters, userData, res, req.language,
        formOps.json(req));
  });
};