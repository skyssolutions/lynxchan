'use strict';

var apiOps = require('../engine/apiOps');
var modOps = require('../engine/modOps').hashBan;

function liftHashBan(userData, parameters, res) {

  modOps.liftHashBan(userData, parameters, function hashBanLifted(error) {
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
    liftHashBan(userData, parameters, res);
  });
};