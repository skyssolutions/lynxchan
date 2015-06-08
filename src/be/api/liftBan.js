'use strict';

var apiOps = require('../engine/apiOps');
var modOps = require('../engine/modOps');

function liftBan(userData, parameters, res) {

  modOps.liftBan(userData, parameters, function banLifted(error) {
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

    liftBan(userData, parameters, res);

  });

};