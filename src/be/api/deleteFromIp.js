'use strict';

var apiOps = require('../engine/apiOps');
var lang = require('../engine/langOps').languagePack();
var delOps = require('../engine/deletionOps');
var mandatoryParameters = [ 'ip' ];

function deleteFromIp(auth, userData, parameters, res) {

  if (apiOps.checkBlankParameters(parameters, mandatoryParameters, res)) {
    return;
  }

  delOps.deleteFromIp(parameters, userData, function deletedFromIp(error) {

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

    deleteFromIp(auth, userData, parameters, res);
  });

};