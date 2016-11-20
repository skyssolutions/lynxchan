'use strict';

var formOps = require('../engine/formOps');
var lang = require('../engine/langOps').languagePack();
var boardOps = require('../engine/boardOps').rules;
var mandatoryParameters = [ 'boardUri', 'ruleIndex' ];

function deleteRule(parameters, userData, res, auth, language) {

  if (formOps.checkBlankParameters(parameters, mandatoryParameters, res)) {
    return;
  }

  boardOps.deleteRule(parameters, userData, function deletedRule(error) {
    if (error) {
      formOps.outputError(error, 500, res, language);
    } else {
      var redirectLink = '/rules.js?boardUri=' + parameters.boardUri;

      formOps.outputResponse(lang.msgRuleDeleted, redirectLink, res, null,
          auth, language);
    }
  });

}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {

    deleteRule(parameters, userData, res, auth, req.language);

  });

};