'use strict';

var formOps = require('../engine/formOps');
var accountOps = require('../engine/accountOps');
var lang = require('../engine/langOps').languagePack;

exports.requestConfirmation = function(domain, auth, userData, res, language,
    json) {

  accountOps.requestConfirmation(domain, language, userData,
      function confirmationRequested(error) {
        if (error) {
          formOps.outputError(error, 500, res, language, json, auth);
        } else {
          formOps.outputResponse(json ? 'ok'
              : lang(language).msgConfirmationSent,
              json ? null : '/account.js', res, null, auth, language, json);
        }
      });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, false,
      function gotData(auth, userData) {
        exports.requestConfirmation(formOps.getDomain(req), auth, userData,
            res, req.language, formOps.json(req));
      });

};