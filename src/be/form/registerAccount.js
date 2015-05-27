'use strict';

var formOps = require('../engine/formOps');
var accountOps = require('../engine/accountOps');
var mandatoryParameters = [ 'login', 'password' ];

function createAccount(parameters, res) {

  if (formOps.checkBlankParameters(parameters, mandatoryParameters, res)) {
    return;
  }

  accountOps.registerUser(parameters, function userCreated(error, hash) {
    if (error) {
      formOps.outputError(error, 500, res);
    } else {
      formOps.outputResponse('Account created.', '/account.js', res, [ {
        field : 'login',
        value : parameters.login
      }, {
        field : 'hash',
        value : hash
      } ]);
    }

  });

}

exports.process = function(req, res) {

  formOps.getPostData(req, res, function gotFormData(auth, parameters) {

    createAccount(parameters, res);

  });

};