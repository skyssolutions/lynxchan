'use strict';

var apiOps = require('../engine/apiOps');
var postingOps = require('../engine/postingOps').thread;
var mandatoryParameters = [ 'message', 'boardUri' ];

function createThread(req, userData, parameters, captchaId, res) {

  postingOps.newThread(req, userData, parameters, captchaId,
      function threadCreated(error, id) {
        if (error) {
          apiOps.outputError(error, res);
        } else {
          apiOps.outputResponse(null, id, 'ok', res);
        }
      });

}

function checkBans(req, res, parameters, userData, captchaId) {

  if (apiOps.checkBlankParameters(parameters, mandatoryParameters, res)) {
    return;
  }

  apiOps.checkForBan(req, parameters.boardUri, res, function checked(error) {
    if (error) {
      apiOps.outputError(error, res);
    } else {

      // style exception, too simple
      apiOps.checkForHashBan(parameters, req, res, function checkedHashBan(
          error) {
        if (error) {
          apiOps.outputError(error, res);
        } else {
          createThread(req, userData, parameters, captchaId, res);
        }
      });
      // style exception, too simple

    }
  });
}

exports.process = function(req, res) {

  apiOps.getAuthenticatedData(req, res, function gotData(auth, userData,
      parameters, captchaId) {
    checkBans(req, res, parameters, userData, captchaId);
  }, true);
};
