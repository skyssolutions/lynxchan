'use strict';

var formOps = require('../engine/formOps');
var lang = require('../engine/langOps').languagePack();
var transferOps = require('../engine/modOps').transfer;
var mandatoryParameters = [ 'boardUri', 'threadId', 'boardUriDestination' ];

function transferThread(userData, parameters, res, auth, language) {

  if (formOps.checkBlankParameters(parameters, mandatoryParameters, res)) {
    return;
  }

  transferOps.transfer(userData, parameters, function transferredThread(error,
      newThreadId) {

    if (error) {
      formOps.outputError(error, 500, res, language);
    } else {

      var redirect = '/' + parameters.boardUriDestination + '/res/';
      redirect += newThreadId + '.html';

      formOps.outputResponse(lang.msgThreadTransferred, redirect, res, null,
          auth, language);
    }

  });
}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {

    transferThread(userData, parameters, res, auth, req.language);

  });
};