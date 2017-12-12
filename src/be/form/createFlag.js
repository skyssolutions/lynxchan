'use strict';

var formOps = require('../engine/formOps');
var lang = require('../engine/langOps').languagePack;
var boardOps = require('../engine/boardOps').flags;
var mandatoryParameters = [ 'flagName', 'boardUri' ];

exports.createFlag = function(parameters, userData, res, auth, language) {

  if (formOps.checkBlankParameters(parameters, mandatoryParameters, res,
      language)) {
    return;
  }

  boardOps.createFlag(userData, parameters, language, function createdFlag(
      error) {
    if (error) {
      formOps.outputError(error, 500, res, language);
    } else {

      var url = '/flags.js?boardUri=' + parameters.boardUri;

      formOps.outputResponse(lang(language).msgFlagCreated, url, res, null,
          auth, language);
    }
  });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {
    exports.createFlag(parameters, userData, res, auth, req.language);
  });

};