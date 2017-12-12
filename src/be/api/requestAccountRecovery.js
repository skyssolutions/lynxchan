'use strict';

var apiOps = require('../engine/apiOps');
var formOps = require('../engine/formOps');
var accountOps = require('../engine/accountOps');

exports.recoverAccount = function(domain, lang, parameters, res, captchaId) {

  if (apiOps.checkBlankParameters(parameters, [ 'login' ], res)) {
    return;
  }

  accountOps.requestRecovery(domain, lang, parameters, captchaId,
      function createdRequest(error) {
        if (error) {
          apiOps.outputError(error, res);
        } else {
          apiOps.outputResponse(null, null, 'ok', res);
        }
      });
};

exports.process = function(req, res) {

  apiOps.getAnonJsonData(req, res,
      function gotData(auth, parameters, captchaId) {
        exports.recoverAccount(formOps.getDomain(req), req.language,
            parameters, res, captchaId);
      });
};