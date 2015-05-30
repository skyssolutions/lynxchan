'use strict';

var formOps = require('../engine/formOps');
var accountOps = require('../engine/accountOps');
var mandatoryParameters = [ 'login', 'role' ];

function setUserRole(userData, parameters, res) {

  if (formOps.checkBlankParameters(parameters, mandatoryParameters, res)) {
    return;
  }

  accountOps.setGlobalRole(userData, parameters,
      function setRole(error) {
        if (error) {
          formOps.outputError(error, res);
        } else {
          formOps.outputResponse('User role changed.', '/globalManagement.js',
              res);
        }
      });

}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {

    setUserRole(userData, parameters, res);

  });

};