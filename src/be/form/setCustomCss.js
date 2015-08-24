'use strict';

var formOps = require('../engine/formOps');
var boardOps = require('../engine/boardOps').meta;
var lang = require('../engine/langOps').languagePack();

function setCustomCss(userData, parameters, res) {

  if (parameters.files.length) {
    boardOps.setCustomCss(userData, parameters.boardUri, parameters.files[0],
        function customCssSet(error, boardUri) {
          if (error) {
            formOps.outputError(error, 500, res);
          } else {

            var redirect = '/boardManagement.js?boardUri=';
            redirect += parameters.boardUri;

            formOps.outputResponse(lang.msgCssSet, redirect, res);
          }
        });
  } else {
    boardOps.deleteCustomCss(userData, parameters.boardUri,
        function deletedCss(error) {
          if (error) {
            formOps.outputError(error, 500, res);
          } else {

            var redirect = '/boardManagement.js?boardUri=';
            redirect += parameters.boardUri;

            formOps.outputResponse(lang.msgCssDeleted, redirect, res);
          }
        });

  }

}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {

    setCustomCss(userData, parameters, res);

  }, false, true);

};