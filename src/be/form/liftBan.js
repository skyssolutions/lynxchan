'use strict';

var formOps = require('../engine/formOps');
var modOps = require('../engine/modOps').ipBan.versatile;
var lang = require('../engine/langOps').languagePack;

exports.liftBan = function(userData, parameters, res, auth, language) {

  modOps.liftBan(userData, parameters, language, function banLifted(error,
      rangeBan, boardUri) {
    if (error) {
      formOps.outputError(error, 500, res, language);
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

      formOps.outputResponse(lang(language).msgBanLifted, redirect, res, null,
          auth, language);
    }
  });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {
    exports.liftBan(userData, parameters, res, auth, req.language);
  });

};