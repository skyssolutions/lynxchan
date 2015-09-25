'use strict';

var formOps = require('../engine/formOps');
var modOps = require('../engine/modOps').ipBan.general;
var lang = require('../engine/langOps').languagePack();

function liftProxyBan(userData, parameters, res) {

  modOps.liftProxyBan(userData, parameters, function proxyBanLifted(error,
      boardUri) {
    if (error) {
      formOps.outputError(error, 500, res);
    } else {

      var redirect = '/proxyBans.js';

      if (boardUri) {
        redirect += '?boardUri=' + boardUri;
      }

      formOps.outputResponse(lang.msgProxyBanLifted, redirect, res);
    }
  });

}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {

    liftProxyBan(userData, parameters, res);

  });

};