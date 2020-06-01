'use strict';

var formOps = require('../engine/formOps');
var lang = require('../engine/langOps').languagePack;
var boardOps = require('../engine/boardOps').meta;
var mandatoryParameters = [ 'boardUri', 'login' ];

exports.transferBoard = function(userData, parameters, res, auth, language,
    json) {

  if (formOps.checkBlankParameters(parameters, mandatoryParameters, res,
      language, json)) {
    return;
  }

  boardOps.transfer(userData, parameters, language, function transferedBoard(
      error) {
    if (error) {
      formOps.outputError(error, 500, res, language, json, auth);
    } else {

      formOps.outputResponse(json ? 'ok' : lang(language).msgBoardTransferred,
          json ? null : '/' + parameters.boardUri + '/', res, null, auth,
          language, json);
    }

  });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {
    exports.transferBoard(userData, parameters, res, auth, req.language,
        formOps.json(req));
  });

};