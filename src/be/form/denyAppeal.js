'use strict';

var formOps = require('../engine/formOps');
var lang = require('../engine/langOps').languagePack();
var modOps = require('../engine/modOps').ipBan.specific;

function denyAppeal(userData, parameters, res) {

  modOps.denyAppeal(userData, parameters.banId, function appealDenied(error,
      board) {
    if (error) {
      formOps.outputError(error, 500, res);
    } else {
      var redirect = '/bans.js';

      if (board) {
        redirect += '?boardUri=' + board;
      }

      formOps.outputResponse(lang.msgAppealDenied, redirect, res);
    }
  });

}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {

    denyAppeal(userData, parameters, res);

  });

};