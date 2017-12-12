'use strict';

var formOps = require('../engine/formOps');
var lang = require('../engine/langOps').languagePack;
var delOps = require('../engine/deletionOps');
var mandatoryParameters = [ 'ip' ];

exports.deleteFromIp = function(userData, parameters, res, auth, language) {

  if (formOps.checkBlankParameters(parameters, mandatoryParameters, res,
      language)) {
    return;
  }

  delOps.deleteFromIp(parameters, userData, language, function deletedFromIp(
      error) {

    if (error) {
      formOps.outputError(error, 500, res, language);
    } else {
      formOps.outputResponse(lang(language).msgDeletedFromIp,
          '/globalManagement.js', res, null, auth, language);
    }

  });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {
    exports.deleteFromIp(userData, parameters, res, auth, req.language);
  });

};