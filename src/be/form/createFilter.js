'use strict';

var formOps = require('../engine/formOps');
var lang = require('../engine/langOps').languagePack;
var url = require('url');
var boardOps = require('../engine/boardOps').filters;
var mandatoryParameters = [ 'boardUri', 'originalTerm', 'replacementTerm' ];

exports.createFilter = function(parameters, userData, res, auth, language) {

  if (formOps.checkBlankParameters(parameters, mandatoryParameters, res,
      language)) {
    return;
  }

  boardOps.createFilter(userData, parameters, language, function filterCreated(
      error, filters) {
    if (error) {
      formOps.outputError(error, 500, res, language, null, auth);
    } else {
      var redirect = '/filterManagement.js?boardUri=' + parameters.boardUri;
      formOps.outputResponse(lang(language).msgFilterCreated, redirect, res,
          null, auth, language);
    }
  });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {
    exports.createFilter(parameters, userData, res, auth, req.language);
  });

};