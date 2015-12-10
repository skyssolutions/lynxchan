'use strict';

var apiOps = require('../engine/apiOps');
var mandatoryParameters = [ 'hash' ];
var modOps = require('../engine/modOps').hashBan;

function placeHashBan(auth, userData, parameters, captchaId, res) {

  if (apiOps.checkBlankParameters(parameters, mandatoryParameters, res)) {
    return;
  }

  modOps.placeHashBan(userData, parameters, captchaId, function hashBanPlaced(
      error) {
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
    placeHashBan(auth, userData, parameters, captchaId, res);
  });
};