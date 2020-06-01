'use strict';

var formOps = require('../engine/formOps');
var lang = require('../engine/langOps').languagePack;
var mediaHandler = require('../engine/mediaHandler');

exports.deleteMedia = function(auth, param, userData, res, language, json) {

  var selectedIdentifiers;

  if (param.text) {
    selectedIdentifiers = param.text.match(/[0-9a-f]{64}/g) || [];
  } else {
    selectedIdentifiers = [];
  }

  for ( var key in param) {

    var match = key.match(/[0-9a-f]{64}/);

    if (match) {
      selectedIdentifiers.push(match.toString());
    }
  }

  mediaHandler.deleteFiles(param, selectedIdentifiers, userData, language,
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