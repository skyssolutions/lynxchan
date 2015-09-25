'use strict';

var apiOps = require('../engine/apiOps');
var modOps = require('../engine/modOps').ipBan.general;

function liftProxyBan(userData, parameters, res) {

  modOps.liftProxyBan(userData, parameters, function proxyBanLifted(error,
      boardUri) {
    if (error) {
      apiOps.outputError(error, res);
    } else {

      apiOps.outputResponse(null, null, 'ok', res);
    }
  });

}

exports.process = function(req, res) {

  apiOps.getAuthenticatedData(req, res, function gotData(auth, userData,
      parameters) {
    liftProxyBan(userData, parameters, res);
  });

};