'use strict';

var formOps = require('../engine/formOps');
var boardOps = require('../engine/boardOps').flags;
var lang = require('../engine/langOps').languagePack();

function deleteFlag(parameters, userData, res) {

  boardOps.deleteFlag(userData.login, parameters.flagId, function deletedFlag(
      error, board) {
    if (error) {
      formOps.outputError(error, 500, res);
    } else {

      var url = '/flags.js?boardUri=' + board;

      formOps.outputResponse(lang.msgFlagDeleted, url, res);
    }
  });

}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {

    deleteFlag(parameters, userData, res);

  });

};