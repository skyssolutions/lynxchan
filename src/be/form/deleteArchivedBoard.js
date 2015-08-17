'use strict';

var formOps = require('../engine/formOps');
var lang = require('../engine/langOps').languagePack();
var archive = require('../archive');

function removeArchivedBoard(userData, parameters, res) {

  if (formOps.checkBlankParameters(parameters, [ 'boardUri' ], res)) {
    return;
  }

  archive.deleteBoard(userData, parameters.boardUri, function reportClosed(
      error, global, board) {
    if (error) {
      formOps.outputError(error, 500, res);
    } else {

      formOps
          .outputResponse(lang.msgArchiveRemoved, '/archiveDeletion.js', res);
    }
  });

}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {

    removeArchivedBoard(userData, parameters, res);

  });

};