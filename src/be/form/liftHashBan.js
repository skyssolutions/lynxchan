'use strict';

var formOps = require('../engine/formOps');
var modOps = require('../engine/modOps').hashBan;
var lang = require('../engine/langOps').languagePack;

exports.liftHashBan = function(userData, parameters, res, auth, language) {

  modOps.liftHashBan(userData, parameters, language, function hashBanLifted(
      error, boardUri) {
    if (error) {
      formOps.outputError(error, 500, res, language, null, auth);
    } else {

      var redirect = '/hashBans.js';

      if (boardUri) {
        redirect += '?boardUri=' + boardUri;
      }

      formOps.outputResponse(lang(language).msgHashBanLifted, redirect, res,
          null, auth, language);
    }
  });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {
    exports.liftHashBan(userData, parameters, res, auth, req.language);
  });

};