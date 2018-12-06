'use strict';

var formOps = require('../engine/formOps');
var modOps = require('../engine/modOps').hashBan;
var lang = require('../engine/langOps').languagePack;

exports.liftHashBan = function(user, parameters, res, auth, language, json) {

  modOps.liftHashBan(user, parameters, language, function hashBanLifted(error,
      boardUri) {
    if (error) {
      formOps.outputError(error, 500, res, language, json, auth);
    } else {

      var redirect = '/hashBans.js';

      if (boardUri) {
        redirect += '?boardUri=' + boardUri;
      }

      formOps.outputResponse(json ? 'ok' : lang(language).msgHashBanLifted,
          json ? null : redirect, res, null, auth, language, json);
    }
  });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {
    exports.liftHashBan(userData, parameters, res, auth, req.language, formOps
        .json(req));
  });

};