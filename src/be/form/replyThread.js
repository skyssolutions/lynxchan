'use strict';

var formOps = require('../engine/formOps');
var postingOps = require('../engine/postingOps');
var mandatoryParameters = [ 'message', 'boardUri', 'threadId' ];

function createPost(req, res, parameters) {

  if (formOps.checkBlankParameters(parameters, mandatoryParameters, res)) {
    return;
  }

  postingOps.newPost(req, parameters, function postCreated(error, id) {
    if (error) {
      formOps.outputError(error, 500, res);
    } else {
      var redirectLink = '../' + parameters.boardUri;
      redirectLink += '/res/' + parameters.threadId + '.html';
      formOps.outputResponse('Post created', redirectLink, res);
    }
  });

}

exports.process = function(req, res) {

  formOps.getPostData(req, res, function gotData(auth, parameters) {

    createPost(req, res, parameters);

  });

};