'use strict';

var apiOps = require('../engine/apiOps');
var modOps = require('../engine/modOps').ipBan.specific;

function banContent(auth, userData, parameters, captchaId, res, language) {

  parameters.global = parameters.global ? true : false;

  modOps.ban(userData, parameters.postings || [], parameters, captchaId,
      language, function bannedUsers(error) {
        if (error) {
          apiOps.outputError(error, res);
        } else {
          apiOps.outputResponse(auth, null, 'ok', res);
        }
      });
}

exports.process = function(req, res) {

  apiOps.getAuthenticatedData(req, res, function gotData(auth, userData,
      parameters, captchaId) {

    banContent(auth, userData, parameters, captchaId, res, req.language);
  });
};