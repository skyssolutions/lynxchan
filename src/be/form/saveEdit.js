'use strict';

var formOps = require('../engine/formOps');
var lang = require('../engine/langOps').languagePack();
var url = require('url');
var modOps = require('../engine/modOps').edit;
var mandatoryParameters = [ 'message', 'boardUri' ];

function saveEdit(parameters, userData, res, auth) {

  if (formOps.checkBlankParameters(parameters, mandatoryParameters, res)) {
    return;
  }

  modOps.saveEdit(userData, parameters, function editSaved(error, filters) {
    if (error) {
      formOps.outputError(error, 500, res);
    } else {
      var redirect = '/edit.js?boardUri=' + parameters.boardUri;
      if (parameters.threadId) {
        redirect += '&threadId=' + parameters.threadId;
      } else {
        redirect += '&postId=' + parameters.postId;
      }

      formOps.outputResponse(lang.msgPostingEdited, redirect, res, null, auth);
    }
  });

}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {

    saveEdit(parameters, userData, res, auth);

  });

};