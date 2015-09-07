'use strict';

var formOps = require('../engine/formOps');
var lang = require('../engine/langOps').languagePack();
var boardOps = require('../engine/boardOps').banners;

function createBanner(parameters, userData, res) {

  boardOps.addBanner(userData, parameters, function createdBanner(error) {
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