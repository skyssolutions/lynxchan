'use strict';

var apiOps = require('../engine/apiOps');
var bannerOps = require('../engine/bannerOps');

exports.createBanner = function(auth, parameters, userData, res, language) {

  bannerOps.addBanner(userData, parameters, language, function createdBanner(
      error) {
    if (error) {
      apiOps.outputError(error, res);
    } else {
      apiOps.outputResponse(auth, null, 'ok', res);
    }
  });
};

exports.process = function(req, res) {

  apiOps.getAuthenticatedData(req, res, function gotData(auth, userData,
      parameters) {

    exports.createBanner(auth, parameters, userData, res, req.language);
  });
};