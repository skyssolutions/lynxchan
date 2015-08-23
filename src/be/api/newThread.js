'use strict';

var apiOps = require('../engine/apiOps');
var postingOps = require('../engine/postingOps').thread;
var mandatoryParameters = [ 'message', 'boardUri' ];

function createThread(req, res, parameters, userData, captchaId) {

  if (apiOps.checkBlankParameters(parameters, mandatoryParameters, res)) {
    return;
  }

  apiOps.checkForBan(req, parameters.boardUri, res, function checked(error) {
    if (error) {
      apiOps.outputError(error, res);
    } else {

      // style exception, too simple
      postingOps.newThread(req, userData, parameters, captchaId,
          function threadCreated(error, id) {
            if (error) {
              apiOps.outputError(error, res);
            } else {
              apiOps.outputResponse(null, id, 'ok', res);
            }
          });
      // style exception, too simple

    }
  });
}

exports.process = function(req, res) {

  apiOps.getAuthenticatedData(req, res, function gotData(auth, userData,
      parameters, captchaId) {
    createThread(req, res, parameters, userData, captchaId);
  }, true);
};
