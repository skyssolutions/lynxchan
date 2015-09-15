'use strict';

var apiOps = require('../engine/apiOps');

exports.process = function(req, res) {

  apiOps.getAuthenticatedData(req, res, function gotData(auth, userData,
      parameters) {

    apiOps.outputResponse(null, null, 'ok', res);

  });
};