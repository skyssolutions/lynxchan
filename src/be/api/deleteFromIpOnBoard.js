'use strict';

var apiOps = require('../engine/apiOps');
var delOps = require('../engine/deletionOps');

exports.deleteFromIp = function(auth, userData, parameters, res, language) {

  delOps.deleteFromIpOnBoard(parameters.confirmation,
      parameters.postings || [], userData, language, function spoiledFiles(
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
    exports.deleteFromIp(auth, userData, parameters, res, req.language);
  });
};