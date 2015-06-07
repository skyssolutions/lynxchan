'use strict';

var apiOps = require('../engine/apiOps');
var modOps = require('../engine/modOps');

function setThreadPin(userData, parameters, res) {

  modOps.setThreadPin(userData, parameters, function pinSet(error) {
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

    setThreadPin(userData, parameters, res);

  });

};