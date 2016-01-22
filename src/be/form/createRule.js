'use strict';

var formOps = require('../engine/formOps');
var lang = require('../engine/langOps').languagePack();
var boardOps = require('../engine/boardOps').rules;
var mandatoryParameters = [ 'rule', 'boardUri' ];

function addRule(parameters, userData, res, auth) {

  if (formOps.checkBlankParameters(parameters, mandatoryParameters, res)) {
    return;
  }

  boardOps.addBoardRule(parameters, userData, function addedRule(error) {
    if (error) {
      formOps.outputError(error, 500, res);
    } else {
      var redirectLink = '/rules.js?boardUri=' + parameters.boardUri;

      formOps
          .outputResponse(lang.msgRuleCreated, redirectLink, res, null, auth);
    }
  });

}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {

    addRule(parameters, userData, res, auth);

  });

};