'use strict';

var formOps = require('../engine/formOps');
var lang = require('../engine/langOps').languagePack;
var modOps = require('../engine/modOps').hashBan;
var mandatoryParameters = [ 'hash' ];

function placeHashBan(userData, parameters, captchaId, res, auth, language) {

  if (formOps.checkBlankParameters(parameters, mandatoryParameters, res,
      language)) {
    return;
  }

  modOps.placeHashBan(userData, parameters, captchaId, language,
      function hashBanPlaced(error) {
        if (error) {
          formOps.outputError(error, 500, res, language);
        } else {
          var redirectLink = '/hashBans.js';

          if (parameters.boardUri) {
            redirectLink += '?boardUri=' + parameters.boardUri;
          }

          formOps.outputResponse(lang(language).msgHashBanCreated,
              redirectLink, res, null, auth, language);
        }
      });

}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {

    placeHashBan(userData, parameters, formOps.getCookies(req).captchaid, res,
        auth, req.language);

  });

};