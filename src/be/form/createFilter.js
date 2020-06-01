'use strict';

var formOps = require('../engine/formOps');
var lang = require('../engine/langOps').languagePack;
var boardOps = require('../engine/boardOps').filters;
var mandatoryParameters = [ 'originalTerm', 'replacementTerm' ];

exports.createFilter = function(param, userData, res, auth, language, json) {

  if (formOps.checkBlankParameters(param, mandatoryParameters, res, language,
      json)) {
    return;
  }

  boardOps.createFilter(userData, param, language, function filterCreated(
      error, filters) {
    if (error) {
      formOps.outputError(error, 500, res, language, json, auth);
    } else {
      formOps.outputResponse(json ? 'ok' : lang(language).msgFilterCreated,
          json ? null : '/filterManagement.js?boardUri=' + param.boardUri, res,
          null, auth, language, json);
    }
  });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {
    exports.createFilter(parameters, userData, res, auth, req.language, formOps
        .json(req));
  });

};