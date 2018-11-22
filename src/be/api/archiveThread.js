'use strict';

var apiOps = require('../engine/apiOps');
var archive = require('../engine/archiveOps');
var mandatoryParameters = [ 'threadId', 'boardUri' ];

exports.archiveThread = function(auth, parameters, userData, res, language) {

  if (apiOps.checkBlankParameters(parameters, mandatoryParameters, res)) {
    return;
  }

  archive.archiveThread(language, parameters, userData,
      function archived(error) {

        if (error) {
          apiOps.outputError(error, res, auth);
        } else {
          apiOps.outputResponse(auth, null, 'ok', res);
        }

      });

};

exports.process = function(req, res) {

  apiOps.getAuthenticatedData(req, res, function gotData(auth, userData,
      parameters) {

    exports.archiveThread(auth, parameters, userData, res, req.language);
  });

};