'use strict';

var apiOps = require('../engine/apiOps');
var deletionOps = require('../engine/deletionOps').miscDeletions;

function deleteBoard(userData, parameters, res) {

  if (apiOps.checkBlankParameters(parameters, [ 'boardUri' ], res)) {
    return;
  }

  deletionOps.board(userData, parameters.boardUri,
      function deletedBoard(error) {
        if (error) {
          apiOps.outputError(error, res);
        } else {
          apiOps.outputResponse(null, null, 'ok', res);
        }
      });
}

exports.process = function(req, res) {

  apiOps.getAuthenticatedData(req, res, function gotData(auth, userData,
      parameters) {

    deleteBoard(userData, parameters, res);
  });
};