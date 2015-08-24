'use strict';

var apiOps = require('../engine/apiOps');
var boardOps = require('../engine/boardOps').meta;

function setCustomSpoiler(parameters, userData, res) {

  if (parameters.files.length) {
    boardOps.setCustomSpoiler(userData, parameters.boardUri,
        parameters.files[0], function customSpoilerSet(error, boardUri) {
          if (error) {
            apiOps.outputError(error, res);
          } else {

            apiOps.outputResponse(null, null, 'ok', res);
          }
        });
  } else {
    boardOps.deleteCustomSpoiler(userData, parameters.boardUri,
        function deletedSpoiler(error) {
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
    setCustomSpoiler(parameters, userData, res);
  }, false, true);
};