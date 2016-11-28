'use strict';

var formOps = require('../engine/formOps');
var lang = require('../engine/langOps').languagePack;
var bannerOps = require('../engine/bannerOps');

function createBanner(parameters, userData, res, auth, language) {

  bannerOps.addBanner(userData, parameters, language, function createdBanner(
      error) {
    if (error) {
      formOps.outputError(error, 500, res, language);
    } else {

      var redirectLink = '/bannerManagement.js';

      if (parameters.boardUri) {
        redirectLink += '?boardUri=' + parameters.boardUri;
      }

      formOps.outputResponse(lang(language).msgBannerCreated, redirectLink,
          res, null, auth, language);
    }
  });

}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {

    createBanner(parameters, userData, res, auth, req.language);

  });

};