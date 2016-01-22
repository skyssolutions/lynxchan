'use strict';

var formOps = require('../engine/formOps');
var lang = require('../engine/langOps').languagePack();
var boardOps = require('../engine/boardOps').meta;
var mandatoryParameters = [ 'boardUri', 'login' ];

function transferBoard(userData, parameters, res, auth) {

  if (formOps.checkBlankParameters(parameters, mandatoryParameters, res)) {
    return;
  }

  boardOps.transfer(userData, parameters, function transferedBoard(error) {
    if (error) {
      formOps.outputError(error, 500, res);
    } else {
      var redirect = '/' + parameters.boardUri + '/';

      formOps.outputResponse(lang.msgBoardTransferred, redirect, res, null,
          auth);
    }

  });

}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {

    transferBoard(userData, parameters, res, auth);

  });

};