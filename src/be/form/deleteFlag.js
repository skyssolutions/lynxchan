'use strict';

var formOps = require('../engine/formOps');
var boardOps = require('../engine/boardOps').flags;
var lang = require('../engine/langOps').languagePack();

function deleteFlag(parameters, userData, res, auth, language) {

  boardOps.deleteFlag(userData, parameters.flagId, function deletedFlag(error,
      board) {
    if (error) {
      formOps.outputError(error, 500, res, language);
    } else {

      var url = '/flags.js?boardUri=' + board;

      formOps.outputResponse(lang.msgFlagDeleted, url, res, null, auth,
          language);
    }
  });

}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {

    deleteFlag(parameters, userData, res, auth, req.language);

  });

};