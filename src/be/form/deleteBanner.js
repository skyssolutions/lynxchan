'use strict';

var formOps = require('../engine/formOps');
var bannerOps = require('../engine/bannerOps');
var lang = require('../engine/langOps').languagePack;

exports.deleteBanner = function(param, userData, res, auth, language, json) {

  bannerOps.deleteBanner(userData, param, language, function deletedBanner(
      error, board) {
    if (error) {
      formOps.outputError(error, 500, res, language, json, auth);
    } else {
      var redirectLink = '/bannerManagement.js';

      if (board) {
        redirectLink += '?boardUri=' + board;
      }

      formOps.outputResponse(json ? 'ok' : lang(language).msgBannerDeleted,
          json ? null : redirectLink, res, null, auth, language, json);

    }
  });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {
    exports.deleteBanner(parameters, userData, res, auth, req.language, formOps
        .json(req));
  });

};