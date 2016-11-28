'use strict';

var formOps = require('../engine/formOps');
var lang = require('../engine/langOps').languagePack;
var url = require('url');
var modOps = require('../engine/modOps').edit;
var mandatoryParameters = [ 'message', 'boardUri' ];

function saveEdit(parameters, userData, res, auth, language) {

  if (formOps.checkBlankParameters(parameters, mandatoryParameters, res,
      language)) {
    return;
  }

  modOps.saveEdit(userData, parameters, language, function editSaved(error) {
    if (error) {
      formOps.outputError(error, 500, res, language);
    } else {
      var redirect = '/edit.js?boardUri=' + parameters.boardUri;
      if (parameters.threadId) {
        redirect += '&threadId=' + parameters.threadId;
      } else {
        redirect += '&postId=' + parameters.postId;
      }

      formOps.outputResponse(lang(language).msgPostingEdited, redirect, res,
          null, auth, language);
    }
  });

}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {

    saveEdit(parameters, userData, res, auth, req.language);

  });

};