'use strict';

var formOps = require('../engine/formOps');
var lang = require('../engine/langOps').languagePack;
var boardOps = require('../engine/boardOps').rules;
var mandatoryParameters = [ 'rule', 'boardUri' ];

exports.addRule = function(parameters, userData, res, auth, language) {

  if (formOps.checkBlankParameters(parameters, mandatoryParameters, res,
      language)) {
    return;
  }

  boardOps.addBoardRule(parameters, userData, language, function addedRule(
      error) {
    if (error) {
      formOps.outputError(error, 500, res, language);
    } else {
      var redirectLink = '/rules.js?boardUri=' + parameters.boardUri;

      formOps.outputResponse(lang(language).msgRuleCreated, redirectLink, res,
          null, auth, language);
    }
  });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {
    exports.addRule(parameters, userData, res, auth, req.language);
  });

};