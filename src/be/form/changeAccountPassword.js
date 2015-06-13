'use strict';

var formOps = require('../engine/formOps');
var accountOps = require('../engine/accountOps');
function changeSettings(userData, parameters, res) {

  accountOps.changePassword(userData, parameters, function changedPassword(
      error, newHash) {

    if (error) {
      formOps.outputError(error, 500, res);
    } else {
      formOps.outputResponse('Password changed', '/account.js', res, [ {
        field : 'hash',
        value : newHash
      } ]);
    }

  });

}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {

    changeSettings(userData, parameters, res);

  });

};