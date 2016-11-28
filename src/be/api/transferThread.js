'use strict';

var apiOps = require('../engine/apiOps');
var mandatoryParameters = [ 'boardUri', 'threadId', 'boardUriDestination' ];
var transferOps = require('../engine/modOps').transfer;

function transferThread(auth, userData, parameters, res, language) {

  if (apiOps.checkBlankParameters(parameters, mandatoryParameters, res)) {
    return;
  }

  transferOps.transfer(userData, parameters, language,
      function transferredThread(error, newThreadId) {

        if (error) {
          apiOps.outputError(error, res);
        } else {
          apiOps.outputResponse(auth, newThreadId, 'ok', res);
        }

      });

}

exports.process = function(req, res) {

  apiOps.getAuthenticatedData(req, res, function gotData(auth, userData,
      parameters) {

    transferThread(auth, userData, parameters, res, req.language);

  });
};