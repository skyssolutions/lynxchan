'use strict';

var apiOps = require('../engine/apiOps');
var mandatoryParameters = [ 'range' ];
var modOps = require('../engine/modOps').ipBan.general;

exports.placeRangeBan = function(auth, userData, parameters, res, language) {

  if (apiOps.checkBlankParameters(parameters, mandatoryParameters, res)) {
    return;
  }

  modOps.placeRangeBan(userData, parameters, language, function rangeBanPlaced(
      error, id) {
    if (error) {
      apiOps.outputError(error, res);
    } else {
      apiOps.outputResponse(auth, id, 'ok', res);
    }
  });
};

exports.process = function(req, res) {

  apiOps.getAuthenticatedData(req, res, function gotData(auth, userData,
      parameters) {
    exports.placeRangeBan(auth, userData, parameters, res, req.language);
  });
};