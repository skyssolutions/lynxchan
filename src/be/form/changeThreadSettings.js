'use strict';

var formOps = require('../engine/formOps');
var lang = require('../engine/langOps').languagePack();
var modOps = require('../engine/modOps').edit;

function saveThreadSettings(userData, parameters, res) {

  modOps.setThreadSettings(userData, parameters, function setThreadSettings(
      error) {
    if (error) {
      formOps.outputError(error, 500, res);
    } else {
      var redirectLink = '/mod.js?boardUri=' + parameters.boardUri;
      redirectLink += '&threadId=' + parameters.threadId;
      formOps.outputResponse(lang.msgThreadSettingsSaved, redirectLink, res);
    }

  });
}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {

    saveThreadSettings(userData, parameters, res);

  });

};