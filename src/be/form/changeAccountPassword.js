'use strict';

var formOps = require('../engine/formOps');
var lang = require('../engine/langOps').languagePack;
var accountOps = require('../engine/accountOps');

exports.changePassword = function(userData, parameters, res, language, auth) {

  accountOps.changePassword(userData, parameters, language,
      function changedPassword(error, newHash, expiration) {

        if (error) {
          formOps.outputError(error, 500, res, language, null, auth);
        } else {

          formOps.outputResponse(lang(language).msgChangedPassword,
              '/account.js', res, null, {
                authStatus : 'expired',
                newHash : newHash,
                expiration : expiration
              }, language);
        }

      });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {
    exports.changePassword(userData, parameters, res, req.language, auth);
  });

};