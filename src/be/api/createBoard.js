'use strict';

var apiOps = require('../engine/apiOps');
var mandatoryParameters = [ 'boardUri', 'boardName', 'boardDescription' ];
var boardOps = require('../engine/boardOps').meta;

function createBoard(auth, userData, parameters, res, captchaId) {

  if (apiOps.checkBlankParameters(parameters, mandatoryParameters, res)) {
    return;
  }

  boardOps.createBoard(captchaId, parameters, userData, function boardCreated(
      error) {
    if (error) {
      apiOps.outputError(error, res);
    } else {
      apiOps.outputResponse(auth, {}, 'ok', res);
    }
  });

}

exports.process = function(req, res) {

  apiOps.getAuthenticatedData(req, res, function gotData(auth, userData,
      parameters, captchaId) {

    createBoard(auth, userData, parameters, res, captchaId);
  });
};