'use strict';

var apiOps = require('../engine/apiOps');
var boardOps = require('../engine/boardOps').custom;

function setCustomJs(auth, parameters, userData, res) {

  if (parameters.files.length) {
    boardOps.setCustomJs(userData, parameters.boardUri, parameters.files[0],
        function customJsSet(error, boardUri) {
          if (error) {
            apiOps.outputError(error, res);
          } else {

            apiOps.outputResponse(auth, null, 'ok', res);
          }
        });
  } else {
    boardOps.deleteCustomJs(userData, parameters.boardUri, function deletedJs(
        error) {
      if (error) {
        apiOps.outputError(error, res);
      } else {
        apiOps.outputResponse(auth, null, 'ok', res);
      }
    });
  }
}

exports.process = function(req, res) {

  apiOps.getAuthenticatedData(req, res, function gotData(auth, userData,
      parameters) {
    setCustomJs(auth, parameters, userData, res);
  }, false, true);
};