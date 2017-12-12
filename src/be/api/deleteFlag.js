'use strict';

var apiOps = require('../engine/apiOps');
var boardOps = require('../engine/boardOps').flags;

exports.deleteFlag = function(auth, parameters, userData, res, language) {

  boardOps.deleteFlag(userData, parameters.flagId, language,
      function deletedFlag(error) {
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
    exports.deleteFlag(auth, parameters, userData, res, req.language);
  });
};