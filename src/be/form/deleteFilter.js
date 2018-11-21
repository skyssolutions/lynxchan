'use strict';

var formOps = require('../engine/formOps');
var url = require('url');
var lang = require('../engine/langOps').languagePack;
var boardOps = require('../engine/boardOps').filters;
var mandatoryParameters = [ 'boardUri', 'filterIdentifier' ];

exports.deleteFilter = function(parameters, userData, res, auth, language) {

  if (formOps.checkBlankParameters(parameters, mandatoryParameters, res,
      language)) {
    return;
  }

  boardOps.deleteFilter(userData, parameters, language, function filterDeleted(
      error, filters) {
    if (error) {
      formOps.outputError(error, 500, res, language, null, auth);
    } else {
      var redirect = '/filterManagement.js?boardUri=' + parameters.boardUri;
      formOps.outputResponse(lang(language).msgFilterDeleted, redirect, res,
          null, auth, language);
    }
  });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {
    exports.deleteFilter(parameters, userData, res, auth, req.language);
  });

};