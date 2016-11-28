'use strict';

var apiOps = require('../engine/apiOps');
var boardOps = require('../engine/boardOps').custom;

function setCustomCss(auth, parameters, userData, res, language) {

  if (parameters.files.length) {
    boardOps.setCustomCss(userData, parameters.boardUri, parameters.files[0],
        language, function customCssSet(error, boardUri) {
          if (error) {
            apiOps.outputError(error, res);
          } else {

            apiOps.outputResponse(auth, null, 'ok', res);
          }
        });
  } else {
    boardOps.deleteCustomCss(userData, parameters.boardUri, language,
        function deletedCss(error) {
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
    setCustomCss(auth, parameters, userData, res, req.language);
  }, false, true);
};