'use strict';

var formOps = require('../engine/formOps');
var lang = require('../engine/langOps').languagePack;
var modOps = require('../engine/modOps').edit;
var mandatoryParameters = [ 'message', 'boardUri' ];

exports.saveEdit = function(parameters, userData, res, auth, language, json) {

  if (formOps.checkBlankParameters(parameters, mandatoryParameters, res,
      language, json)) {
    return;
  }

  modOps.saveEdit(userData, parameters, language, function editSaved(error) {
    if (error) {
      formOps.outputError(error, 500, res, language, json, auth);
    } else {
      var redirect = '/edit.js?boardUri=' + parameters.boardUri;
      if (parameters.threadId) {
        redirect += '&threadId=' + parameters.threadId;
      } else {
        redirect += '&postId=' + parameters.postId;
      }

      formOps.outputResponse(json ? 'ok' : lang(language).msgPostingEdited,
          json ? null : redirect, res, null, auth, language, json);
    }
  });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {
    exports.saveEdit(parameters, userData, res, auth, req.language, formOps
        .json(req));
  });

};