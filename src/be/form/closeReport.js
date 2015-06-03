'use strict';

var formOps = require('../engine/formOps');
var modOps = require('../engine/modOps');

function closeReport(userData, parameters, res) {

  modOps.closeReport(userData, parameters, function reportClosed(error) {
    if (error) {
      formOps.outputError(error, res);
    } else {
      formOps.outputResponse('Report closed', '/', res);
    }
  });

}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {

    closeReport(userData, parameters, res);

  });

};