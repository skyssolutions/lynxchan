'use strict';

var formOps = require('../engine/formOps');
var lang = require('../engine/langOps').languagePack();
var bannerOps = require('../engine/bannerOps');

function createBanner(parameters, userData, res) {

  bannerOps.addBanner(userData, parameters, function createdBanner(error) {
    if (error) {
      formOps.outputError(error, 500, res);
    } else {
      formOps.outputResponse(lang.msgBannerCreated,
          '/bannerManagement.js?boardUri=' + parameters.boardUri, res);
    }
  });

}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {

    createBanner(parameters, userData, res);

  });

};