'use strict';

var formOps = require('../engine/formOps');
var lang = require('../engine/langOps').languagePack;
var metaOps = require('../engine/boardOps').meta;
var mand = [ 'boardUri' ];

exports.resetLock = function(userData, params, res, auth, language, json) {

  if (formOps.checkBlankParameters(params, mand, res, language, json)) {
    return;
  }

  metaOps.unlockAutoLock(userData, params, language, function deletedBoard(
      error) {
    if (error) {
      formOps.outputError(error, 500, res, language, json, auth);
    } else {
      formOps.outputResponse(json ? 'ok' : lang(language).msgBoardUnlocked,
          json ? null : '/boardManagement.js?boardUri=' + params.boardUri, res,
          null, auth, language, json);
    }
  });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {
    exports.resetLock(userData, parameters, res, auth, req.language, formOps
        .json(req));
  });

};