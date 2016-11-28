'use strict';

var apiOps = require('../engine/apiOps');
var modOps = require('../engine/modOps').spoiler;

function spoilFiles(auth, userData, parameters, res, language) {

  modOps.spoiler(userData, parameters.postings || [], language,
      function spoiledFiles(error) {

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
    spoilFiles(auth, userData, parameters, res, req.language);
  });
};