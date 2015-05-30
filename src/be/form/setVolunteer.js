'use strict';

var formOps = require('../engine/formOps');
var boardOps = require('../engine/boardOps');

function setVolunteer(userData, parameters, res) {

  parameters.add = parameters.add === 'true';

  boardOps.setVolunteer(userData, parameters, function setVolunteer(error) {

    if (error) {
      formOps.outputError(error, 500, res);
    } else {
      var redirect = '/boardManagement.js?boardUri=' + parameters.boardUri;
      formOps.outputResponse(parameters.add ? 'Volunteer added'
          : 'Volunteer removed', redirect, res);
    }

  });

}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {

    setVolunteer(userData, parameters, res);

  });

};