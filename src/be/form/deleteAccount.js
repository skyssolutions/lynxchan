'use strict';

var formOps = require('../engine/formOps');
var accountOps = require('../engine/accountOps');
var languageOps = require('../engine/langOps');
var lang = languageOps.languagePack;

exports.deleteAccount = function(auth, parameters, userData, res, language,
    json) {

  accountOps.deleteAccount(userData, parameters, language,
      function accountDeleted(error) {
        if (error) {
          formOps.outputError(error, 500, res, language, json, auth);
        } else {

          var redirect = parameters.account ? '/accounts.js' : '/';

          formOps.outputResponse(
              json ? 'ok' : lang(language).msgAccountDeleted, json ? null
                  : redirect, res, null, auth, language, json);
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