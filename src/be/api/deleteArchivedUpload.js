'use strict';

var apiOps = require('../engine/apiOps');
var archive = require('../archive');
var mandatoryParameters = [ 'boardUri', 'filename' ];

function removeArchivedUpload(userData, parameters, res) {

  if (apiOps.checkBlankParameters(parameters, mandatoryParameters, res)) {
    return;
  }

  archive.deleteUpload(userData, parameters, function reportClosed(error) {
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

    removeArchivedUpload(userData, parameters, res);

  });

};