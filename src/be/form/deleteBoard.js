'use strict';

var formOps = require('../engine/formOps');
var lang = require('../engine/langOps').languagePack;
var deletionOps = require('../engine/deletionOps').miscDeletions;

exports.deleteBoard = function(userData, parameters, res, auth, language) {

  if (formOps.checkBlankParameters(parameters, [ 'boardUri' ], res, language)) {
    return;
  }

  deletionOps.board(userData, parameters, language,
      function deletedBoard(error) {
        if (error) {
          formOps.outputError(error, 500, res, language);
        } else {
          formOps.outputResponse(lang(language).msgBoardDeleted, '/', res,
              null, auth, language);
        }
      });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {
    exports.deleteBoard(userData, parameters, res, auth, req.language);
  });

};