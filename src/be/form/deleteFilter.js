'use strict';

var formOps = require('../engine/formOps');
var lang = require('../engine/langOps').languagePack;
var boardOps = require('../engine/boardOps').filters;
var mandatoryParameters = [ 'filterIdentifier' ];

exports.deleteFilter = function(param, userData, res, auth, language, json) {

  if (formOps.checkBlankParameters(param, mandatoryParameters, res, language,
      json)) {
    return;
  }

  boardOps.deleteFilter(userData, param, language, function filterDeleted(
      error, filters) {
    if (error) {
      formOps.outputError(error, 500, res, language, json, auth);
    } else {
      var redirect = '/filterManagement.js?boardUri=' + param.boardUri;
      formOps.outputResponse(json ? 'ok' : lang(language).msgFilterDeleted,
          json ? null : redirect, res, null, auth, language, json);
    }
  });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {
    exports.deleteFilter(parameters, userData, res, auth, req.language, formOps
        .json(req));
  });

};