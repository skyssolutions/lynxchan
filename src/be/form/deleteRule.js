'use strict';

var formOps = require('../engine/formOps');
var lang = require('../engine/langOps').languagePack();
var boardOps = require('../engine/boardOps');

function deleteRule(parameters, userData, res) {

  boardOps.deleteRule(parameters, userData, function deletedRule(error) {
    if (error) {
      formOps.outputError(error, 500, res);
    } else {
      var redirectLink = '/rules.js?boardUri=' + parameters.boardUri;

      formOps.outputResponse(lang.msgRuleDeleted, redirectLink, res);
    }
  });

}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {

    deleteRule(parameters, userData, res);

  });

};