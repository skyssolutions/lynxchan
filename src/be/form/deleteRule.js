'use strict';

var formOps = require('../engine/formOps');
var lang = require('../engine/langOps').languagePack;
var boardOps = require('../engine/boardOps').rules;
var mandatoryParameters = [ 'boardUri', 'ruleIndex' ];

exports.deleteRule = function(parameters, userData, res, auth, language, json) {

  if (formOps.checkBlankParameters(parameters, mandatoryParameters, res,
      language, json)) {
    return;
  }

  boardOps.deleteRule(parameters, userData, language, function deletedRule(
      error) {
    if (error) {
      formOps.outputError(error, 500, res, language, json, auth);
    } else {
      var redirectLink = '/rules.js?boardUri=' + parameters.boardUri;

      formOps.outputResponse(json ? 'ok' : lang(language).msgRuleDeleted,
          json ? null : redirectLink, res, null, auth, language, json);
    }
  });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {
    exports.deleteRule(parameters, userData, res, auth, req.language, formOps
        .json(req));
  });

};