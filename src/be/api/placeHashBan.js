'use strict';

var apiOps = require('../engine/apiOps');
var mandatoryParameters = [ 'hash' ];
var modOps = require('../engine/modOps');

function placeHashBan(userData, parameters, res) {

  if (apiOps.checkBlankParameters(parameters, mandatoryParameters, res)) {
    return;
  }

  modOps.placeHashBan(userData, parameters, function hashBanPlaced(error) {
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

    placeHashBan(userData, parameters, res);

  });

};