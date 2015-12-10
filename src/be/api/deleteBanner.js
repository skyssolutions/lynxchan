'use strict';

var apiOps = require('../engine/apiOps');
var bannerOps = require('../engine/bannerOps');

function deleteBanner(auth, parameters, userData, res) {

  bannerOps.deleteBanner(userData, parameters, function deletedBanner(error) {
    if (error) {
      apiOps.outputError(error, res);
    } else {
      apiOps.outputResponse(auth, null, 'ok', res);
    }
  });
}

exports.process = function(req, res) {

  apiOps.getAuthenticatedData(req, res, function gotData(auth, userData,
      parameters) {

    deleteBanner(auth, parameters, userData, res);
  });
};