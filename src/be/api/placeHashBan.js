'use strict';

var apiOps = require('../engine/apiOps');
var mandatoryParameters = [ 'hash' ];
var modOps = require('../engine/modOps').hashBan;

exports.placeHashBan = function(auth, userData, parameters, res, language) {

  if (apiOps.checkBlankParameters(parameters, mandatoryParameters, res)) {
    return;
  }

  modOps.placeHashBan(userData, parameters, language, function hashBanPlaced(
      error, id) {
    if (error) {
      apiOps.outputError(error, res, auth);
    } else {
      apiOps.outputResponse(auth, id, 'ok', res);
    }
  });
};

exports.process = function(req, res) {

  apiOps.getAuthenticatedData(req, res, function gotData(auth, userData,
      parameters) {
    exports.placeHashBan(auth, userData, parameters, res, req.language);
  });
};