'use strict';

var apiOps = require('../engine/apiOps');
var archive = require('../archive');
var mandatoryParameters = [ 'boardUri', 'threadId' ];

function removeArchivedThread(auth, userData, parameters, res) {

  if (apiOps.checkBlankParameters(parameters, mandatoryParameters, res)) {
    return;
  }

  archive.deleteThread(userData, parameters, function reportClosed(error) {
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

    removeArchivedThread(auth, userData, parameters, res);

  });

};