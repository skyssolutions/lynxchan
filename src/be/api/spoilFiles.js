'use strict';

var apiOps = require('../engine/apiOps');
var modOps = require('../engine/modOps').spoiler;

function spoilFiles(userData, parameters, res) {

  modOps.spoiler(userData, parameters.postings || [], function spoiledFiles(
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
    spoilFiles(userData, parameters, res);
  });
};