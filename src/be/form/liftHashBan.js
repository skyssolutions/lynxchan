'use strict';

var formOps = require('../engine/formOps');
var modOps = require('../engine/modOps').hashBan;
var lang = require('../engine/langOps').languagePack();

function liftHashBan(userData, parameters, res, auth) {

  modOps.liftHashBan(userData, parameters, function hashBanLifted(error,
      boardUri) {
    if (error) {
      formOps.outputError(error, 500, res);
    } else {

      var redirect = '/hashBans.js';

      if (boardUri) {
        redirect += '?boardUri=' + boardUri;
      }

      formOps.outputResponse(lang.msgHashBanLifted, redirect, res, null, auth);
    }
  });

}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {

    liftHashBan(userData, parameters, res, auth);

  });

};