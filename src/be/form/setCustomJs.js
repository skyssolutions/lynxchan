'use strict';

var formOps = require('../engine/formOps');
var boardOps = require('../engine/boardOps').custom;
var lang = require('../engine/langOps').languagePack;

exports.setCustomJs = function(user, parameters, res, auth, language, json) {

  if (parameters.files.length) {

    boardOps.setCustomJs(user, parameters.boardUri, parameters.files[0],
        language, function customJsSet(error, boardUri) {
          if (error) {
            formOps.outputError(error, 500, res, language, json, auth);
          } else {

            var redirect = '/boardManagement.js?boardUri=';
            redirect += parameters.boardUri;

            formOps.outputResponse(json ? 'ok' : lang(language).msgJsSet,
                json ? null : redirect, res, null, auth, language, json);
          }
        });

  } else {

    boardOps.deleteCustomJs(user, parameters.boardUri, language,
        function deletedJs(error) {
          if (error) {
            formOps.outputError(error, 500, res, language, json, auth);
          } else {

            var redirect = '/boardManagement.js?boardUri=';
            redirect += parameters.boardUri;

            formOps.outputResponse(json ? 'ok' : lang(language).msgJsDeleted,
                json ? null : redirect, res, null, auth, language, json);
          }
        });

  }

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {

    // style exception, too simple
    formOps.validateMimes(parameters, parameters.files, function(error) {

      var json = formOps.json(req);

      if (error) {
        formOps.outputError(error, 500, res, req.language, json, auth);
      } else {
        exports
            .setCustomJs(userData, parameters, res, auth, req.language, json);
      }

    });
    // style exception, too simple

  });

};