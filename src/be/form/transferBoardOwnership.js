'use strict';

var formOps = require('../engine/formOps');
var boardOps = require('../engine/boardOps');

function transferBoard(userData, parameters, res) {

  boardOps.transfer(userData, parameters, function transferedBoard(error) {
    if (error) {
      formOps.outputError(error, 500, res);
    } else {
      var redirect = '/' + parameters.boardUri + '/';

      formOps.outputResponse('Board ownership transfered', redirect, res);
    }

  });

}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {

    transferBoard(userData, parameters, res);

  });

};