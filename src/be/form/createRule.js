'use strict';

var formOps = require('../engine/formOps');
var lang = require('../engine/langOps').languagePack();
var boardOps = require('../engine/boardOps');
var mandatoryParameters = [ 'rule' ];

function addRule(parameters, userData, res) {

  if (formOps.checkBlankParameters(parameters, mandatoryParameters, res)) {
    return;
  }

  boardOps.addBoardRule(parameters, userData, function addedRule(error) {
    if (error) {
      formOps.outputError(error, 500, res);
    } else {
      var redirectLink = '/rules.js?boardUri=' + parameters.boardUri;

      formOps.outputResponse(lang.msgRuleCreated, redirectLink, res);
    }
  });

}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {

    addRule(parameters, userData, res);

  });

};