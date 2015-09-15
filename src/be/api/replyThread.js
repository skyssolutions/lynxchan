'use strict';

var apiOps = require('../engine/apiOps');
var postingOps = require('../engine/postingOps').post;
var mandatoryParameters = [ 'message', 'boardUri', 'threadId' ];

function createPost(req, userData, parameters, captchaId, res) {

  postingOps.newPost(req, userData, parameters, captchaId,
      function postCreated(error, id) {
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
          createPost(req, userData, parameters, captchaId, res);
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
