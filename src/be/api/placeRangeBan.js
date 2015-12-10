'use strict';

var apiOps = require('../engine/apiOps');
var mandatoryParameters = [ 'range' ];
var modOps = require('../engine/modOps').ipBan.general;

function placeRangeBan(auth, userData, parameters, captchaId, res) {

  if (apiOps.checkBlankParameters(parameters, mandatoryParameters, res)) {
    return;
  }

  modOps.placeRangeBan(userData, parameters, captchaId,
      function rangeBanPlaced(error) {
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
    placeRangeBan(auth, userData, parameters, captchaId, res);
  });
};