'use strict';

var formOps = require('../engine/formOps');
var lang = require('../engine/langOps').languagePack();
var deletionOps = require('../engine/deletionOps');

function deleteBoard(userData, parameters, res) {

  if (formOps.checkBlankParameters(parameters, [ 'boardUri' ], res)) {
    return;
  }

  deletionOps.board(userData, parameters.boardUri,
      function deletedBoard(error) {
        if (error) {
          formOps.outputError(error, 500, res);
        } else {
          formOps.outputResponse(lang.msgBoardDeleted, '/', res);
        }
      });

}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {

    deleteBoard(userData, parameters, res);

  });

};