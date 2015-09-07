'use strict';

var apiOps = require('../engine/apiOps');
var boardOps = require('../engine/boardOps').banners;

function createBanner(parameters, userData, res) {

  boardOps.addBanner(userData, parameters, function createdBanner(error) {
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

    createBanner(parameters, userData, res);
  });
};