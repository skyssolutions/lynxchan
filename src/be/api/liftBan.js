'use strict';

var apiOps = require('../engine/apiOps');
var modOps = require('../engine/modOps').ipBan.versatile;

function liftBan(auth, userData, parameters, res, language) {

  modOps.liftBan(userData, parameters, language, function banLifted(error) {
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
    liftBan(auth, userData, parameters, res, req.language);
  });
};