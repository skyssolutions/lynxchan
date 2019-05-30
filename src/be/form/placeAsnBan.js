'use strict';

var formOps = require('../engine/formOps');
var modOps = require('../engine/modOps').ipBan.general;
var lang = require('../engine/langOps').languagePack;
var mandatoryParameters = [ 'asn' ];

exports.placeAsnBan = function(user, parameters, res, auth, language, json) {

  if (formOps.checkBlankParameters(parameters, mandatoryParameters, res,
      language, json)) {
    return;
  }

  modOps.placeAsnBan(user, parameters, language, function asnBanPlaced(error,
      id) {
    if (error) {
      formOps.outputError(error, 500, res, language, json, auth);
    } else {
      var redirectLink = '/asnBans.js';

      if (parameters.boardUri) {
        redirectLink += '?boardUri=' + parameters.boardUri;
      }

      formOps.outputResponse(json ? 'ok' : lang(language).msgAsnBanCreated,
          json ? id : redirectLink, res, null, auth, language, json);
    }
  });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {

    exports.placeAsnBan(userData, parameters, res, auth, req.language, formOps
        .json(req));

  });

};