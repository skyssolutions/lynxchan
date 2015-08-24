'use strict';

var apiOps = require('../engine/apiOps');
var boardOps = require('../engine/boardOps').banners;

function deleteBanner(parameters, userData, res) {

  boardOps.deleteBanner(userData.login, parameters, function deletedBanner(
      error) {
    if (error) {
      apiOps.outputError(error, res);
    } else {
      apiOps.outputResponse(null, null, 'ok', res);
    }
  });
}

exports.process = function(req, res) {

  apiOps.getAuthenticatedData(req, res, function gotData(auth, userData,
      parameters) {

    deleteBanner(parameters, userData, res);
  });
};