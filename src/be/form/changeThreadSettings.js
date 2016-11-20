'use strict';

var formOps = require('../engine/formOps');
var lang = require('../engine/langOps').languagePack();
var modOps = require('../engine/modOps').edit;
var mandatoryParameters = [ 'boardUri', 'threadId' ];

function saveThreadSettings(userData, parameters, res, auth, language) {

  if (formOps.checkBlankParameters(parameters, mandatoryParameters, res)) {
    return;
  }

  modOps.setThreadSettings(userData, parameters, function setThreadSettings(
      error) {
    if (error) {
      formOps.outputError(error, 500, res);
    } else {
      var redirectLink = '/mod.js?boardUri=' + parameters.boardUri;
      redirectLink += '&threadId=' + parameters.threadId;
      formOps.outputResponse(lang.msgThreadSettingsSaved, redirectLink, res,
          null, auth, language);
    }

  });
}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {

    saveThreadSettings(userData, parameters, res, auth, req.language);

  });

};