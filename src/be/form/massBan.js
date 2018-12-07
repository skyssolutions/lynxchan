'use strict';

var formOps = require('../engine/formOps');
var banOps = require('../engine/modOps').ipBan.specific;
var lang = require('../engine/langOps').languagePack;
var mandatoryParameters = [ 'ips' ];

exports.massBan = function(auth, parameters, userData, res, language, json) {

  if (formOps.checkBlankParameters(parameters, mandatoryParameters, res,
      language, json)) {
    return;
  }

  parameters.ips = parameters.ips.split(',');

  banOps.massBan(userData, parameters, language, function massBanned(error) {
    if (error) {
      formOps.outputError(error, 500, res, language, json, auth);
    } else {
      formOps
          .outputResponse(json ? 'ok' : lang(language).msgMassBanned,
              json ? null : '/globalManagement.js', res, null, auth, language,
              json);

    }
  });
};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {
    exports.massBan(auth, parameters, userData, res, req.language, formOps
        .json(req));
  });
};