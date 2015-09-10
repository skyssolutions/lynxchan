'use strict';

var formOps = require('../engine/formOps');
var bannerOps = require('../engine/bannerOps');
var lang = require('../engine/langOps').languagePack();

function deleteBanner(parameters, userData, res) {

  bannerOps.deleteBanner(userData, parameters, function deletedBanner(error,
      board) {
    if (error) {
      formOps.outputError(error, 500, res);
    } else {
      formOps.outputResponse(lang.msgBannerDeleted,
          '/bannerManagement.js?boardUri=' + board, res);
    }
  });

}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {

    deleteBanner(parameters, userData, res);

  });

};