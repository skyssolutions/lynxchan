'use strict';

var apiOps = require('../engine/apiOps');
var boardOps = require('../engine/boardOps');

function setVolunteer(auth, userData, parameters, res) {

  boardOps.setVolunteer(userData, parameters, function setVolunteer(error) {

    if (error) {
      apiOps.outputError(error, res);
    } else {
      apiOps.outputResponse(auth, null, 'ok', res);
    }

  });

}

exports.process = function(req, res) {

  apiOps.getAuthenticatedData(req, res, function gotData(auth, userData,
      parameters) {

    setVolunteer(auth, userData, parameters, res);

  });

};