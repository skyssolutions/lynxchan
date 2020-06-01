'use strict';

var formOps = require('../engine/formOps');
var lang = require('../engine/langOps').languagePack;
var accountOps = require('../engine/accountOps');

exports.changePassword = function(userData, parameters, res, language, auth,
    json) {

  accountOps.changePassword(userData, parameters, language,
      function changedPassword(error, newHash, expiration) {

        if (error) {
          formOps.outputError(error, 500, res, language, json, auth);
        } else {

          formOps.outputResponse(json ? 'ok'
              : lang(language).msgChangedPassword, json ? null : '/account.js',
              res, null, newHash ? {
                authStatus : 'expired',
                newHash : newHash,
                expiration : expiration
              } : {
                authStatus : 'ok'
              }, language, json);

        }

      });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {
    exports.changePassword(userData, parameters, res, req.language, auth,
        formOps.json(req));
  });

};