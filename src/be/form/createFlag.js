'use strict';

var formOps = require('../engine/formOps');
var lang = require('../engine/langOps').languagePack();
var boardOps = require('../engine/boardOps').flags;
var mandatoryParameters = [ 'flagName' ];

function createFlag(parameters, userData, res) {

  if (formOps.checkBlankParameters(parameters, mandatoryParameters, res)) {
    return;
  }

  boardOps.createFlag(userData.login, parameters, function createdFlag(error) {
    if (error) {
      formOps.outputError(error, 500, res);
    } else {

      var url = '/flags.js?boardUri=' + parameters.boardUri;

      formOps.outputResponse(lang.msgFlagCreated, url, res);
    }
  });

}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {

    createFlag(parameters, userData, res);

  });

};