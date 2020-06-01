'use strict';

var formOps = require('../engine/formOps');
var accountOps = require('../engine/accountOps');
var lang = require('../engine/langOps').languagePack;
var mandatoryParameters = [ 'login', 'role' ];

exports.setUserRole = function(userData, param, res, auth, language, json) {

  if (formOps.checkBlankParameters(param, mandatoryParameters, res, language,
      json)) {
    return;
  }

  accountOps.setGlobalRole(userData, param, language, function setRole(error) {
    if (error) {
      formOps.outputError(error, 500, res, language, json, auth);
    } else {
      formOps
          .outputResponse(json ? 'ok' : lang(language).msgUserRoleChanged,
              json ? null : '/globalManagement.js', res, null, auth, language,
              json);
    }
  });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {
    exports.setUserRole(userData, parameters, res, auth, req.language, formOps
        .json(req));
  });

};