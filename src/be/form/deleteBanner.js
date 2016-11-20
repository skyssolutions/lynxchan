'use strict';

var formOps = require('../engine/formOps');
var bannerOps = require('../engine/bannerOps');
var lang = require('../engine/langOps').languagePack();

function deleteBanner(parameters, userData, res, auth, language) {

  bannerOps.deleteBanner(userData, parameters, function deletedBanner(error,
      board) {
    if (error) {
      formOps.outputError(error, 500, res);
    } else {
      var redirectLink = '/bannerManagement.js';

      if (board) {
        redirectLink += '?boardUri=' + board;
      }

      formOps.outputResponse(lang.msgBannerDeleted, redirectLink, res, null,
          auth, language);
    }
  });

}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {

    deleteBanner(parameters, userData, res, auth, req.language);

  });

};