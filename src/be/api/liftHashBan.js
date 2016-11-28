'use strict';

var apiOps = require('../engine/apiOps');
var modOps = require('../engine/modOps').hashBan;

function liftHashBan(auth, userData, parameters, res, language) {

  modOps.liftHashBan(userData, parameters, language, function hashBanLifted(
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
      parameters) {
    liftHashBan(auth, userData, parameters, res, req.language);
  });
};