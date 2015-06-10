'use strict';

var formOps = require('../engine/formOps');
var modOps = require('../engine/modOps');

function saveThreadSettings(userData, parameters, res) {

  modOps.setThreadSettings(userData, parameters, function setThreadSettings(
      error) {
    if (error) {
      formOps.outputError(error, res);
    } else {
      var redirectLink = '/mod.js?boardUri=' + parameters.boardUri;
      redirectLink += '&threadId=' + parameters.threadId;
      formOps.outputResponse('Thread settings saved.', redirectLink, res);
    }

  });
}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {

    saveThreadSettings(userData, parameters, res);

  });

};