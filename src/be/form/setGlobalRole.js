'use strict';

var formOps = require('../engine/formOps');
var accountOps = require('../engine/accountOps');
var lang = require('../engine/langOps').languagePack;
var mandatoryParameters = [ 'login', 'role' ];

exports.setUserRole = function(userData, parameters, res, auth, language) {

  if (formOps.checkBlankParameters(parameters, mandatoryParameters, res,
      language)) {
    return;
  }

  accountOps.setGlobalRole(userData, parameters, language, function setRole(
      error) {
    if (error) {
      formOps.outputError(error, 500, res, language);
    } else {
      formOps.outputResponse(lang(language).msgUserRoleChanged,
          '/globalManagement.js', res, null, auth, language);
    }
  });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {
    exports.setUserRole(userData, parameters, res, auth, req.language);
  });

};