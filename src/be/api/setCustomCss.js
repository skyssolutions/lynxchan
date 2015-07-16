'use strict';

var apiOps = require('../engine/apiOps');
var boardOps = require('../engine/boardOps');

function setCustomCss(parameters, userData, res) {

  if (parameters.files.length) {
    boardOps.setCustomCss(userData, parameters.boardUri, parameters.files[0],
        function hashBanLifted(error, boardUri) {
          if (error) {
            apiOps.outputError(error, res);
          } else {

            apiOps.outputResponse(null, null, 'ok', res);
          }
        });
  } else {
    boardOps.deleteCustomCss(userData, parameters.boardUri,
        function deletedCss(error) {
          if (error) {
            apiOps.outputError(error, res);
          } else {

            apiOps.outputResponse(null, null, 'ok', res);
          }
        });

  }

}

exports.process = function(req, res) {

  apiOps.getAuthenticatedData(req, res, function gotData(auth, userData,
      parameters) {

    setCustomCss(parameters, userData, res);

  });

};