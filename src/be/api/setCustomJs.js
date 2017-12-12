'use strict';

var apiOps = require('../engine/apiOps');
var boardOps = require('../engine/boardOps').custom;

exports.setCustomJs = function(auth, parameters, userData, res, language) {

  if (parameters.files.length) {
    boardOps.setCustomJs(userData, parameters.boardUri, parameters.files[0],
        language, function customJsSet(error, boardUri) {
          if (error) {
            apiOps.outputError(error, res);
          } else {

            apiOps.outputResponse(auth, null, 'ok', res);
          }
        });
  } else {
    boardOps.deleteCustomJs(userData, parameters.boardUri, language,
        function deletedJs(error) {
          if (error) {
            apiOps.outputError(error, res);
          } else {
            apiOps.outputResponse(auth, null, 'ok', res);
          }
        });
  }
};

exports.process = function(req, res) {

  apiOps.getAuthenticatedData(req, res, function gotData(auth, userData,
      parameters) {
    exports.setCustomJs(auth, parameters, userData, res, req.language);
  }, false, true);
};