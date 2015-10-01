'use strict';

var apiOps = require('../engine/apiOps');
var modOps = require('../engine/modOps').ipBan.specific;

function reportContent(userData, parameters, captchaId, res) {

  parameters.global = parameters.global ? true : false;

  modOps.ban(userData, parameters.postings || [], parameters, captchaId,
      function createdReports(error) {
        if (error) {
          apiOps.outputError(error, res);
        } else {
          apiOps.outputResponse(null, null, 'ok', res);
        }
      });
}

exports.process = function(req, res) {

  apiOps.getAuthenticatedData(req, res, function gotData(auth, userData,
      parameters, captchaId) {

    reportContent(userData, parameters, captchaId, res);
  });
};