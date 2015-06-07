'use strict';

var apiOps = require('../engine/apiOps');
var modOps = require('../engine/modOps');

function setThreadLock(userData, parameters, res) {

  modOps.setThreadLock(userData, parameters, function lockSet(error) {
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

    setThreadLock(userData, parameters, res);

  });

};