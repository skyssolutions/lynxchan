'use strict';

var formOps = require('../engine/formOps');
var boardOps = require('../engine/boardOps').custom;
var lang = require('../engine/langOps').languagePack();

function setCustomSpoiler(userData, parameters, res, auth, language) {

  if (parameters.files.length) {
    boardOps.setCustomSpoiler(userData, parameters.boardUri,
        parameters.files[0], function customSpoilerSet(error, boardUri) {
          if (error) {
            formOps.outputError(error, 500, res);
          } else {

            var redirect = '/boardManagement.js?boardUri=';
            redirect += parameters.boardUri;

            formOps.outputResponse(lang.msgSpoilerSet, redirect, res, null,
                auth, language);
          }
        });
  } else {
    boardOps.deleteCustomSpoiler(userData, parameters.boardUri,
        function deletedSpoiler(error) {
          if (error) {
            formOps.outputError(error, 500, res);
          } else {

            var redirect = '/boardManagement.js?boardUri=';
            redirect += parameters.boardUri;

            formOps.outputResponse(lang.msgSpoilerDeleted, redirect, res, null,
                auth, language);
          }
        });

  }

}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {

    setCustomSpoiler(userData, parameters, res, auth, req.language);

  }, false, true);

};