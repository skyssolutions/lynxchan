'use strict';

// handles the thread creation when using forms and not javascript
var miscOps = require('../engine/miscOps');
var formOps = require('../engine/formOps');
var postingOps = require('../engine/postingOps');

function createThread(req, res, parameters) {

  var mandatoryParameters = [ 'message', 'boardUri' ];

  if (formOps.checkBlankParameters(parameters, mandatoryParameters, res)) {
    return;
  }

  postingOps.newThread(req, parameters, function threadCreated(error, id) {
    if (error) {
      formOps.outputError(error, res);
    } else {
      var redirectLink = '../' + parameters.boardUri;
      redirectLink += ' / ' + id + '.html';
      formOps.outputResponse('Thread created', redirectLink, res);
    }
  });

}

exports.process = function(req, res) {

  miscOps.getPostData(req, res, function gotData(auth, parameters) {

    createThread(req, res, parameters);

  });

};