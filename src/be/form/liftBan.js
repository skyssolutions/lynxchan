'use strict';

var formOps = require('../engine/formOps');
var modOps = require('../engine/modOps');

function liftBan(userData, parameters, res) {

  modOps.liftBan(userData, parameters, function banLifted(error) {
    if (error) {
      formOps.outputError(error, res);
    } else {
      formOps.outputResponse('Ban lifted', '/', res);
    }
  });

}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {

    liftBan(userData, parameters, res);

  });

};