'use strict';

var apiOps = require('../engine/apiOps');
var bypassOps = require('../engine/bypassOps');
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

function useBypass(req, res, parameters, userData, captchaId, bypassId) {

  bypassOps.useBypass(bypassId, req, function usedBypass(error) {

    if (error) {
      apiOps.outputError(error, res);
    } else {
      checkBans(req, res, parameters, userData, captchaId);
    }
  });
}

exports.process = function(req, res) {

  apiOps.getAuthenticatedData(req, res, function gotData(auth, userData,
      parameters, captchaId, bypassId) {
    useBypass(req, res, parameters, userData, captchaId, bypassId);
  }, true);
};
