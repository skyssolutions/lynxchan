'use strict';

var formOps = require('../engine/formOps');
var accountOps = require('../engine/accountOps');
var lang = require('../engine/langOps').languagePack();
var mandatoryParameters = [ 'login', 'role' ];

function setUserRole(userData, parameters, res, auth, language) {

  if (formOps.checkBlankParameters(parameters, mandatoryParameters, res)) {
    return;
  }

  accountOps.setGlobalRole(userData, parameters, function setRole(error) {
    if (error) {
      formOps.outputError(error, 500, res);
    } else {
      formOps.outputResponse(lang.msgUserRoleChanged, '/globalManagement.js',
          res, null, auth, language);
    }
  });

}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {

    setUserRole(userData, parameters, res, auth, req.language);

  });

};