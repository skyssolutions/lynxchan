'use strict';

var formOps = require('../engine/formOps');
var lang = require('../engine/langOps').languagePack;
var deletionOps = require('../engine/deletionOps').miscDeletions;
var mand = [ 'boardUri' ];

exports.deleteBoard = function(userData, params, res, auth, language, json) {

  if (formOps.checkBlankParameters(params, mand, res, language, json)) {
    return;
  }

  deletionOps.board(userData, params, language, function deletedBoard(error) {
    if (error) {
      formOps.outputError(error, 500, res, language, json, auth);
    } else {
      formOps.outputResponse(json ? 'ok' : lang(language).msgBoardDeleted,
          json ? null : '/', res, null, auth, language, json);
    }
  });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {
    exports.deleteBoard(userData, parameters, res, auth, req.language, formOps
        .json(req));
  });

};