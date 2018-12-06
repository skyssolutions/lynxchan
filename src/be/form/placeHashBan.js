'use strict';

var formOps = require('../engine/formOps');
var lang = require('../engine/langOps').languagePack;
var modOps = require('../engine/modOps').hashBan;
var mandatoryParameters = [ 'hash' ];

exports.placeHashBan = function(user, parameters, res, auth, language, json) {

  if (formOps.checkBlankParameters(parameters, mandatoryParameters, res,
      language, json)) {
    return;
  }

  modOps.placeHashBan(user, parameters, language, function hashBanPlaced(error,
      id) {
    if (error) {
      formOps.outputError(error, 500, res, language, json, auth);
    } else {
      var redirectLink = '/hashBans.js';

      if (parameters.boardUri) {
        redirectLink += '?boardUri=' + parameters.boardUri;
      }

      formOps.outputResponse(json ? 'ok' : lang(language).msgHashBanCreated,
          json ? id : redirectLink, res, null, auth, language, json);
    }
  });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {
    exports.placeHashBan(userData, parameters, res, auth, req.language, formOps
        .json(req));
  });

};