'use strict';

var formOps = require('../engine/formOps');
var modOps = require('../engine/modOps');

function closeReport(userData, parameters, res) {

  modOps.closeReport(userData, parameters, function reportClosed(error, global,
      board) {
    if (error) {
      formOps.outputError(error, 500, res);
    } else {
      formOps.outputResponse('Report closed', global ? '/globalManagement.js'
          : '/boardManagement.js?boardUri=' + board, res);
    }
  });

}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {

    closeReport(userData, parameters, res);

  });

};