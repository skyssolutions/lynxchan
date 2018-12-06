'use strict';

var formOps = require('../engine/formOps');
var boardOps = require('../engine/boardOps').custom;
var lang = require('../engine/langOps').languagePack;

exports.setCustomCss = function(user, parameters, res, auth, language, json) {

  if (parameters.files.length) {
    boardOps.setCustomCss(user, parameters.boardUri, parameters.files[0],
        language, function customCssSet(error, boardUri) {
          if (error) {
            formOps.outputError(error, 500, res, language, json, auth);
          } else {

            var redirect = '/boardManagement.js?boardUri=';
            redirect += parameters.boardUri;

            formOps.outputResponse(json ? 'ok' : lang(language).msgCssSet,
                json ? null : redirect, res, null, auth, language, json);
          }
        });
  } else {
    boardOps.deleteCustomCss(user, parameters.boardUri, language,
        function deletedCss(error) {
          if (error) {
            formOps.outputError(error, 500, res, language, json, auth);
          } else {

            var redirect = '/boardManagement.js?boardUri=';
            redirect += parameters.boardUri;

            formOps.outputResponse(json ? 'ok' : lang(language).msgCssDeleted,
                json ? null : redirect, res, null, auth, language, json);
          }
        });

  }

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {
    exports.setCustomCss(userData, parameters, res, auth, req.language, formOps
        .json(req));
  }, false, true);

};