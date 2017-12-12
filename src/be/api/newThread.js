'use strict';

var apiOps = require('../engine/apiOps');
var bypassOps = require('../engine/bypassOps');
var postingOps = require('../engine/postingOps').thread;
var mandatoryParameters = [ 'message', 'boardUri' ];

exports.createThread = function(req, userData, params, captchaId, res, auth) {

  postingOps.newThread(req, userData, params, captchaId,
      function threadCreated(error, id) {
        if (error) {
          apiOps.outputError(error, res);
        } else {
          apiOps.outputResponse(auth, id, 'ok', res);
        }
      });

};

exports.checkBans = function(req, res, parameters, userData, captchaId, auth) {

  if (apiOps.checkBlankParameters(parameters, mandatoryParameters, res)) {
    return;
  }

  apiOps.checkForBan(req, parameters.boardUri, res, function checked(error) {
    if (error) {
      apiOps.outputError(error, res);
    } else {

      // style exception, too simple
      apiOps.checkForHashBan(parameters, req, res,
          function checkedHashBan(error) {
            if (error) {
              apiOps.outputError(error, res);
            } else {
              exports.createThread(req, userData, parameters, captchaId, res,
                  auth);
            }
          });
      // style exception, too simple

    }
  }, auth);
};

exports.useBypass = function(req, res, parameters, userData, captchaId,
    bypassId, auth) {

  bypassOps.useBypass(bypassId, req, function usedBypass(error) {

    if (error) {
      apiOps.outputError(error, res);
    } else {
      exports.checkBans(req, res, parameters, userData, captchaId, auth);
    }
  });
};

exports.process = function(req, res) {

  apiOps.getAuthenticatedData(req, res, function gotData(auth, userData,
      parameters, captchaId, bypassId) {
    exports
        .useBypass(req, res, parameters, userData, captchaId, bypassId, auth);
  }, true);
};
