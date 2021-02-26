'use strict';

var formOps = require('../engine/formOps');
var lang = require('../engine/langOps').languagePack;
var boardOps = require('../engine/boardOps').rules;
var mandatoryParameters = [ 'boardUri', 'ruleIndex' ];

exports.deleteRule = function(parameters, userData, res, auth, language, json) {

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

exports.editRule = function(parameters, userData, res, auth, language, json) {

  boardOps.editRule(parameters, userData, language, function editedRule(error) {
    if (error) {
      formOps.outputError(error, 500, res, language, json, auth);
    } else {
      var redirectLink = '/rules.js?boardUri=' + parameters.boardUri;

      formOps.outputResponse(json ? 'ok' : lang(language).msgRuleEdited,
          json ? null : redirectLink, res, null, auth, language, json);
    }
  });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {

    var json = formOps.json(req);

    if (formOps.checkBlankParameters(parameters, mandatoryParameters, res,
        req.language, json)) {
      return;
    }

    var toUse = parameters.action === 'edit' ? exports.editRule
        : exports.deleteRule;

    toUse(parameters, userData, res, auth, req.language, json);

  });

};