'use strict';

var apiOps = require('../engine/apiOps');
var archive = require('../archive');

function removeArchivedBoard(auth, userData, parameters, res) {

  if (apiOps.checkBlankParameters(parameters, [ 'boardUri' ], res)) {
    return;
  }

  archive.deleteBoard(userData, parameters, function reportClosed(error) {
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

    removeArchivedBoard(auth, userData, parameters, res);

  });

};