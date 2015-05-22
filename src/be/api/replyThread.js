'use strict';

var apiOps = require('../engine/apiOps');
var postingOps = require('../engine/postingOps');
var mandatoryParameters = [ 'message', 'boardUri', 'threadId' ];

function createPost(req, res, parameters) {

  if (apiOps.checkBlankParameters(parameters, mandatoryParameters, res)) {
    return;
  }

  postingOps.newPost(req, parameters, function postCreated(error, id) {
    if (error) {
      apiOps.outputError(error, res);
    } else {
      apiOps.outputResponse(null, id, 'ok', res);
    }
  });

}

exports.process = function(req, res) {

  apiOps.getAnonJsonData(req, res, function gotData(auth, parameters) {

    createPost(req, res, parameters);

  });

};
