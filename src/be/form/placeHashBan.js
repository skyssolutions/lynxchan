'use strict';

var formOps = require('../engine/formOps');
var lang = require('../engine/langOps').languagePack();
var modOps = require('../engine/modOps').hashBan;
var mandatoryParameters = [ 'hash' ];

function placeHashBan(userData, parameters, captchaId, res) {

  if (formOps.checkBlankParameters(parameters, mandatoryParameters, res)) {
    return;
  }

  modOps.placeHashBan(userData, parameters, captchaId, function hashBanPlaced(
      error) {
    if (error) {
      formOps.outputError(error, 500, res);
    } else {
      var redirectLink = '/hashBans.js';

      if (parameters.boardUri) {
        redirectLink += '?boardUri=' + parameters.boardUri;
      }

      formOps.outputResponse(lang.msgHashBanCreated, redirectLink, res);
    }
  });

}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {

    placeHashBan(userData, parameters, formOps.getCookies(req).captchaid, res);

  });

};