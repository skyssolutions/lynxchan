'use strict';

var apiOps = require('../engine/apiOps');
var mandatoryParameters = [ 'hash' ];
var modOps = require('../engine/modOps').hashBan;

exports.placeHashBan = function(auth, userData, parameters, captchaId, res,
    language) {

  if (apiOps.checkBlankParameters(parameters, mandatoryParameters, res)) {
    return;
  }

  modOps.placeHashBan(userData, parameters, captchaId, language,
      function hashBanPlaced(error) {
        if (error) {
          apiOps.outputError(error, res);
        } else {
          apiOps.outputResponse(auth, null, 'ok', res);
        }
      });
};

exports.process = function(req, res) {

  apiOps.getAuthenticatedData(req, res, function gotData(auth, userData,
      parameters, captchaId) {
    exports.placeHashBan(auth, userData, parameters, captchaId, res,
        req.language);
  });
};