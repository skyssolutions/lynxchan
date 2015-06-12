'use strict';

var apiOps = require('../engine/apiOps');
var postingOps = require('../engine/postingOps');
var mandatoryParameters = [ 'message', 'boardUri', 'threadId' ];

function createPost(req, res, parameters) {

  if (apiOps.checkBlankParameters(parameters, mandatoryParameters, res)) {
    return;
  }

  apiOps.checkForBan(req, parameters.boardUri, res, function checked(error) {
    if (error) {
      apiOps.outputError(error, res);
    } else {

      // style exception, too simple

      postingOps.newPost(req, parameters, function postCreated(error, id) {
        if (error) {
          apiOps.outputError(error, res);
        } else {
          apiOps.outputResponse(null, id, 'ok', res);
        }
      });
      // style exception, too simple

    }
  });

}

exports.process = function(req, res) {

  apiOps.getAnonJsonData(req, res, function gotData(auth, parameters) {

    createPost(req, res, parameters);

  }, true);

};
