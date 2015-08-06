'use strict';

var formOps = require('../engine/formOps');
var lang = require('../engine/langOps').languagePack();
var accountOps = require('../engine/accountOps');
function changePassword(userData, parameters, res) {

  accountOps.changePassword(userData, parameters, function changedPassword(
      error, newHash) {

    if (error) {
      formOps.outputError(error, 500, res);
    } else {
      formOps.outputResponse(lang.msgChangedPassword, '/account.js', res, [ {
        field : 'hash',
        value : newHash
      } ]);
    }

  });

}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {

    changePassword(userData, parameters, res);

  });

};