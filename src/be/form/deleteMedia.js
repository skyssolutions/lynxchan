'use strict';

var formOps = require('../engine/formOps');
var lang = require('../engine/langOps').languagePack;
var mediaHandler = require('../engine/mediaHandler');

exports.deleteMedia = function(auth, param, userData, res, language, json) {

  var selectedIdentifiers = [];

  for ( var key in param) {
    if (param.hasOwnProperty(key)) {
      selectedIdentifiers.push(key);
    }
  }

  mediaHandler.deleteFiles(selectedIdentifiers, userData, language,
      function deletedFiles(error) {

        if (error) {
          formOps.outputError(error, 500, res, language, json, auth);
        } else {

          formOps.outputResponse(json ? 'ok' : lang(language).msgMediaDeleted,
              json ? null : '/mediaManagement.js', res, null, auth, language,
              json);

        }
      });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {
    exports.deleteMedia(auth, parameters, userData, res, req.language, formOps
        .json(req));
  });

};