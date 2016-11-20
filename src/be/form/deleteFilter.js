'use strict';

var formOps = require('../engine/formOps');
var url = require('url');
var lang = require('../engine/langOps').languagePack();
var boardOps = require('../engine/boardOps').filters;
var mandatoryParameters = [ 'boardUri', 'filterIdentifier' ];

function deleteFilter(parameters, userData, res, auth, language) {

  if (formOps.checkBlankParameters(parameters, mandatoryParameters, res)) {
    return;
  }

  boardOps.deleteFilter(userData, parameters, function filterDeleted(error,
      filters) {
    if (error) {
      formOps.outputError(error, 500, res, language);
    } else {
      var redirect = '/filterManagement.js?boardUri=' + parameters.boardUri;
      formOps.outputResponse(lang.msgFilterDeleted, redirect, res, null, auth,
          language);
    }
  });

}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {

    deleteFilter(parameters, userData, res, auth, req.language);

  });

};