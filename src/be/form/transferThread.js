'use strict';

var formOps = require('../engine/formOps');
var lang = require('../engine/langOps').languagePack();
var transferOps = require('../engine/modOps').transfer;
var mandatoryParameters = [ 'boardUri', 'threadId', 'boardUriDestination' ];

function transferThread(userData, parameters, res) {

  if (formOps.checkBlankParameters(parameters, mandatoryParameters, res)) {
    return;
  }

  transferOps.transfer(userData, parameters, function transferredThread(error) {

    if (error) {
      formOps.outputError(error, 500, res);
    } else {

      var redirect = '/' + parameters.boardUri + '/';
      formOps.outputResponse(lang.msgThreadTransferred, redirect, res);
    }

  });
}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {

    transferThread(userData, parameters, res);

  });
};