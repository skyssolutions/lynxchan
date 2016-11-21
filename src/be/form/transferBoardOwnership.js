'use strict';

var formOps = require('../engine/formOps');
var lang = require('../engine/langOps').languagePack();
var boardOps = require('../engine/boardOps').meta;
var mandatoryParameters = [ 'boardUri', 'login' ];

function transferBoard(userData, parameters, res, auth, language) {

  if (formOps.checkBlankParameters(parameters, mandatoryParameters, res,
      language)) {
    return;
  }

  boardOps.transfer(userData, parameters, function transferedBoard(error) {
    if (error) {
      formOps.outputError(error, 500, res, language);
    } else {
      var redirect = '/' + parameters.boardUri + '/';

      formOps.outputResponse(lang.msgBoardTransferred, redirect, res, null,
          auth, language);
    }

  });

}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {

    transferBoard(userData, parameters, res, auth, req.language);

  });

};