'use strict';

var apiOps = require('../engine/apiOps');
var bannerOps = require('../engine/bannerOps');

exports.deleteBanner = function(auth, parameters, userData, res, language) {

  bannerOps.deleteBanner(userData, parameters, language,
      function deletedBanner(error) {
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

    exports.deleteBanner(auth, parameters, userData, res, req.language);
  });
};