'use strict';

var formOps = require('../engine/formOps');
var lang = require('../engine/langOps').languagePack();
var boardOps = require('../engine/boardOps').meta;
var mandatoryParameters = [ 'boardUri', 'login' ];

function setVolunteer(userData, parameters, res, auth, language) {

  if (formOps.checkBlankParameters(parameters, mandatoryParameters, res)) {
    return;
  }

  parameters.add = parameters.add === 'true';

  boardOps.setVolunteer(userData, parameters, function setVolunteer(error) {

    if (error) {
      formOps.outputError(error, 500, res, language);
    } else {
      var redirect = '/boardManagement.js?boardUri=' + parameters.boardUri;
      formOps.outputResponse(parameters.add ? lang.msgVolunteerAdded
          : lang.msgVolunteerRemoved, redirect, res, null, auth, language);
    }

  });

}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {

    setVolunteer(userData, parameters, res, auth, req.language);

  });

};