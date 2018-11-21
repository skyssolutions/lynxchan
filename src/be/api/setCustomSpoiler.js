'use strict';

var apiOps = require('../engine/apiOps');
var boardOps = require('../engine/boardOps').custom;

exports.setCustomSpoiler = function(auth, parameters, userData, res, language) {

  if (parameters.files.length) {
    boardOps.setCustomSpoiler(userData, parameters.boardUri,
        parameters.files[0], language, function customSpoilerSet(error,
            boardUri) {
          if (error) {
            apiOps.outputError(error, res, auth);
          } else {

            apiOps.outputResponse(auth, null, 'ok', res);
          }
        });
  } else {
    boardOps.deleteCustomSpoiler(userData, parameters.boardUri, language,
        function deletedSpoiler(error) {
          if (error) {
            apiOps.outputError(error, res, auth);
          } else {
            apiOps.outputResponse(auth, null, 'ok', res);
          }
        });
  }
};

exports.process = function(req, res) {

  apiOps.getAuthenticatedData(req, res, function gotData(auth, userData,
      parameters) {
    exports.setCustomSpoiler(auth, parameters, userData, res, req.language);
  }, false, true);
};