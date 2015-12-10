'use strict';

var apiOps = require('../engine/apiOps');
var modOps = require('../engine/modOps').ipBan.specific;

function denyAppeal(auth, userData, parameters, res) {

  modOps.denyAppeal(userData, parameters.banId, function reportClosed(error) {
    if (error) {
      apiOps.outputError(error, res);
    } else {
      apiOps.outputResponse(auth, null, 'ok', res);
    }
  });
}

exports.process = function(req, res) {

  apiOps.getAuthenticatedData(req, res, function gotData(auth, userData,
      parameters) {

    denyAppeal(auth, userData, parameters, res);
  });
};