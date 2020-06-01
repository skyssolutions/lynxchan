'use strict';

var formOps = require('../engine/formOps');
var lang = require('../engine/langOps').languagePack;
var bannerOps = require('../engine/bannerOps');

exports.createBanners = function(param, userData, res, auth, language, json) {

  var ids = [];

  bannerOps.addBanners(userData, param, ids, language, function createdBanner(
      error) {
    if (error) {
      formOps.outputError(error, 500, res, language, json, auth);
    } else {

      var redirectLink = '/bannerManagement.js';

      if (param.boardUri) {
        redirectLink += '?boardUri=' + param.boardUri;
      }

      formOps.outputResponse(json ? 'ok' : lang(language).msgBannerCreated,
          json ? ids : redirectLink, res, null, auth, language, json);
    }
  });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {

    // style exception, too simple
    formOps.validateMimes(parameters, parameters.files, function(error) {

      var json = formOps.json(req);

      if (error) {
        formOps.outputError(error, 500, res, req.language, json, auth);
      } else {
        exports.createBanners(parameters, userData, res, auth, req.language,
            json);
      }

    });
    // style exception, too simple

  });

};