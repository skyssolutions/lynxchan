'use strict';

var apiOps = require('../engine/apiOps');
var modOps = require('../engine/modOps').ipBan.general;
var mandatoryParameters = [ 'proxyIp' ];

function placeProxyBan(auth, userData, parameters, captchaId, res) {

  if (apiOps.checkBlankParameters(parameters, mandatoryParameters, res)) {
    return;
  }

  modOps.placeProxyBan(userData, parameters, captchaId,
      function proxyBanPlaced(error) {
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
    placeProxyBan(auth, userData, parameters, captchaId, res);
  });

};