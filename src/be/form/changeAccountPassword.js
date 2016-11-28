'use strict';

var formOps = require('../engine/formOps');
var lang = require('../engine/langOps').languagePack();
var accountOps = require('../engine/accountOps');
function changePassword(userData, parameters, res, language) {

  accountOps.changePassword(userData, parameters, language,
      function changedPassword(error, newHash) {

        if (error) {
          formOps.outputError(error, 500, res, language);
        } else {
          formOps.outputResponse(lang.msgChangedPassword, '/account.js', res,
              [ {
                field : 'hash',
                value : newHash
              } ], null, language);
        }

      });

}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {

    changePassword(userData, parameters, res, req.language);

  });

};