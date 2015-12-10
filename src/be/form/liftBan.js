'use strict';

var formOps = require('../engine/formOps');
var modOps = require('../engine/modOps').ipBan.versatile;
var lang = require('../engine/langOps').languagePack();

function liftBan(userData, parameters, res, auth) {

  modOps.liftBan(userData, parameters, function banLifted(error, rangeBan,
      boardUri) {
    if (error) {
      formOps.outputError(error, 500, res);
    } else {

      var redirect = '/';

      if (rangeBan) {
        redirect += 'rangeBans.js';
      } else {
        redirect += 'bans.js';
      }

      if (boardUri) {
        redirect += '?boardUri=' + boardUri;
      }

      formOps.outputResponse(lang.msgBanLifted, redirect, res, null, auth);
    }
  });

}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {

    liftBan(userData, parameters, res, auth);

  });

};