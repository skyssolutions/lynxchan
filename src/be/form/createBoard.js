'use strict';

var formOps = require('../engine/formOps');
var mandatoryParameters = [ 'boardUri', 'boardName', 'boardDescription' ];
var boardOps = require('../engine/boardOps');

function createBoard(auth, userData, parameters, res) {

  if (formOps.checkBlankParameters(parameters, mandatoryParameters, res)) {
    return;
  }

  boardOps.createBoard(parameters, userData.login,
      function boardCreated(error) {
        if (error) {
          formOps.outputError(error, res);
        } else {
          var redirectLink = '/' + parameters.boardUri + '/';

          formOps.outputResponse('Board created.', redirectLink, res, auth);
        }
      });

}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {

    createBoard(auth, userData, parameters, res);

  });

};