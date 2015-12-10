'use strict';

var apiOps = require('../engine/apiOps');
var bypassOps = require('../engine/bypassOps');
var postingOps = require('../engine/postingOps').post;
var mandatoryParameters = [ 'boardUri', 'threadId' ];

function createPost(req, userData, parameters, captchaId, res, auth) {

  postingOps.newPost(req, userData, parameters, captchaId,
      function postCreated(error, id) {
        if (error) {
          apiOps.outputError(error, res);
        } else {
          apiOps.outputResponse(auth, id, 'ok', res);
        }
      });

}

function checkBans(req, res, parameters, userData, captchaId, auth) {

  if (apiOps.checkBlankParameters(parameters, mandatoryParameters, res)) {
    return;
  }

  apiOps.checkForBan(req, parameters.boardUri, res, function checkedBan(error) {
    if (error) {
      apiOps.outputError(error, res);
    } else {

      // style exception, too simple
      apiOps.checkForHashBan(parameters, req, res, function checkedHashBan(
          error) {
        if (error) {
          apiOps.outputError(error, res);
        } else {
          createPost(req, userData, parameters, captchaId, res, auth);
        }
      });
      // style exception, too simple

    }
  }, auth);
}

function useBypass(req, res, parameters, userData, captchaId, bypassId, auth) {

  bypassOps.useBypass(bypassId, req, function usedBypass(error) {

    if (error) {
      apiOps.outputError(error, res);
    } else {
      checkBans(req, res, parameters, userData, captchaId, auth);
    }
  });
}

exports.process = function(req, res) {

  apiOps.getAuthenticatedData(req, res, function gotData(auth, userData,
      parameters, captchaId, bypassId) {
    useBypass(req, res, parameters, userData, captchaId, bypassId, auth);
  }, true);
};
