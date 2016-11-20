'use strict';

var formOps = require('../engine/formOps');
var boardOps = require('../engine/boardOps').custom;
var lang = require('../engine/langOps').languagePack();

function setCustomJs(userData, parameters, res, auth, language) {

  if (parameters.files.length) {
    boardOps.setCustomJs(userData, parameters.boardUri, parameters.files[0],
        function customJsSet(error, boardUri) {
          if (error) {
            formOps.outputError(error, 500, res, language);
          } else {

            var redirect = '/boardManagement.js?boardUri=';
            redirect += parameters.boardUri;

            formOps.outputResponse(lang.msgJsSet, redirect, res, null, auth,
                language);
          }
        });
  } else {
    boardOps.deleteCustomJs(userData, parameters.boardUri, function deletedJs(
        error) {
      if (error) {
        formOps.outputError(error, 500, res, language);
      } else {

        var redirect = '/boardManagement.js?boardUri=';
        redirect += parameters.boardUri;

        formOps.outputResponse(lang.msgJsDeleted, redirect, res, null, auth,
            language);
      }
    });

  }

}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {

    setCustomJs(userData, parameters, res, auth, req.language);

  }, false, true);

};