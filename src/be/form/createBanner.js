'use strict';

var formOps = require('../engine/formOps');
var lang = require('../engine/langOps').languagePack;
var bannerOps = require('../engine/bannerOps');

exports.createBanner = function(param, userData, res, auth, language, json) {

  bannerOps.addBanner(userData, param, language, function createdBanner(error,
      id, path) {
    if (error) {
      formOps.outputError(error, 500, res, language, json, auth);
    } else {

      var redirectLink = '/bannerManagement.js';

      if (param.boardUri) {
        redirectLink += '?boardUri=' + param.boardUri;
      }

      formOps.outputResponse(json ? 'ok' : lang(language).msgBannerCreated,
          json ? {
            id : id,
            path : path
          } : redirectLink, res, null, auth, language, json);
    }
  });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {
    exports.createBanner(parameters, userData, res, auth, req.language, formOps
        .json(req));
  });

};