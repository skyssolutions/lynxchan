'use strict';

var apiOps = require('../engine/apiOps');
var modOps = require('../engine/modOps').ipBan.specific;

exports.denyAppeal = function(auth, userData, parameters, res, language) {

  modOps.denyAppeal(userData, parameters.banId, language,
      function reportClosed(error) {
        if (error) {
          apiOps.outputError(error, res);
        } else {
          apiOps.outputResponse(auth, null, 'ok', res);
        }
      });
};

exports.process = function(req, res) {

  apiOps.getAuthenticatedData(req, res, function gotData(auth, userData,
      parameters) {

    exports.denyAppeal(auth, userData, parameters, res, req.language);
  });
};