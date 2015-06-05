'use strict';

var formOps = require('../engine/formOps');
var postingOps = require('../engine/postingOps');
var mandatoryParameters = [ 'message', 'boardUri' ];

function createThread(req, res, parameters) {

  if (formOps.checkBlankParameters(parameters, mandatoryParameters, res)) {
    return;
  }

  formOps.checkForBan(req, parameters.boardUri, res,
      function checkedBan(error) {

        if (error) {
          formOps.outputError(error, 500, res);
        } else {

          // style exception, too simple
          postingOps.newThread(req, parameters, function threadCreated(error,
              id) {
            if (error) {
              formOps.outputError(error, 500, res);
            } else {
              var redirectLink = '../' + parameters.boardUri;
              redirectLink += '/res/' + id + '.html';
              formOps.outputResponse('Thread created', redirectLink, res);
            }
          });
          // style exception, too simple

        }

      });

}

exports.process = function(req, res) {

  formOps.getPostData(req, res, function gotData(auth, parameters) {

    createThread(req, res, parameters);

  });

};