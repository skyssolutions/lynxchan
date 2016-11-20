'use strict';

var formOps = require('../engine/formOps');
var modOps = require('../engine/modOps').ipBan.general;
var lang = require('../engine/langOps').languagePack();
var mandatoryParameters = [ 'range' ];

function placeRangeBan(userData, parameters, captchaId, res, auth, language) {

  if (formOps.checkBlankParameters(parameters, mandatoryParameters, res)) {
    return;
  }

  modOps.placeRangeBan(userData, parameters, captchaId,
      function rangeBanPlaced(error) {
        if (error) {
          formOps.outputError(error, 500, res);
        } else {
          var redirectLink = '/rangeBans.js';

          if (parameters.boardUri) {
            redirectLink += '?boardUri=' + parameters.boardUri;
          }

          formOps.outputResponse(lang.msgRangeBanCreated, redirectLink, res,
              null, auth, language);
        }
      });

}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {

    placeRangeBan(userData, parameters, formOps.getCookies(req).captchaid, res,
        auth, req.language);

  });

};