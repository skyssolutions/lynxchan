'use strict';

var formOps = require('../engine/formOps');
var accountOps = require('../engine/accountOps');

function changeSettings(userData, parameters, res) {

  accountOps.changeSettings(userData, parameters, function changedSettings(
      error) {

    if (error) {
      formOps.outputError(error, 500, res);
    } else {
      formOps.outputResponse('Settings saved', '/account.js', res);
    }

  });

}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {

    changeSettings(userData, parameters, res);

  });

};