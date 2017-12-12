'use strict';

var apiOps = require('../engine/apiOps');
var mandatoryParameters = [ 'boardUri', 'boardName', 'boardDescription' ];
var boardOps = require('../engine/boardOps').meta;

exports.createBoard = function(auth, userData, parameters, res, captchaId,
    language) {

  if (apiOps.checkBlankParameters(parameters, mandatoryParameters, res)) {
    return;
  }

  boardOps.createBoard(captchaId, parameters, userData, language,
      function boardCreated(error) {
        if (error) {
          apiOps.outputError(error, res);
        } else {
          apiOps.outputResponse(auth, {}, 'ok', res);
        }
      });

};

exports.process = function(req, res) {

  apiOps.getAuthenticatedData(req, res, function gotData(auth, userData,
      parameters, captchaId) {

    exports.createBoard(auth, userData, parameters, res, captchaId,
        req.language);
  });
};