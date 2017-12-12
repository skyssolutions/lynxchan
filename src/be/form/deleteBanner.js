'use strict';

var formOps = require('../engine/formOps');
var bannerOps = require('../engine/bannerOps');
var lang = require('../engine/langOps').languagePack;

exports.deleteBanner = function(parameters, userData, res, auth, language) {

  bannerOps.deleteBanner(userData, parameters, language,
      function deletedBanner(error, board) {
        if (error) {
          formOps.outputError(error, 500, res, language);
        } else {
          var redirectLink = '/bannerManagement.js';

          if (board) {
            redirectLink += '?boardUri=' + board;
          }

          formOps.outputResponse(lang(language).msgBannerDeleted, redirectLink,
              res, null, auth, language);
        }
      });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {
    exports.deleteBanner(parameters, userData, res, auth, req.language);
  });

};