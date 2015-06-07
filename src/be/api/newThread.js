'use strict';

var apiOps = require('../engine/apiOps');
var postingOps = require('../engine/postingOps');
var mandatoryParameters = [ 'message', 'boardUri' ];

function createThread(req, res, parameters) {

  if (apiOps.checkBlankParameters(parameters, mandatoryParameters, res)) {
    return;
  }

  postingOps.newThread(req, parameters, function threadCreated(error, id) {
    if (error) {
      apiOps.outputError(error, res);
    } else {
      apiOps.outputResponse(null, id, 'ok', res);
    }
  });

}

exports.process = function(req, res) {

  apiOps.getAnonJsonData(req, res, function gotData(auth, parameters) {

    createThread(req, res, parameters);

  }, true);

};
