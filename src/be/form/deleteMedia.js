'use strict';

var formOps = require('../engine/formOps');
var lang = require('../engine/langOps').languagePack;
var mediaHandler = require('../engine/mediaHandler');

exports.deleteMedia = function(auth, parameters, userData, res, language) {

  var selectedIdentifiers = [];

  for ( var key in parameters) {
    if (parameters.hasOwnProperty(key)) {
      selectedIdentifiers.push(key);
    }
  }

  mediaHandler.deleteFiles(selectedIdentifiers, userData, language,
      function deletedFiles(error) {

        if (error) {
          formOps.outputError(error, 500, res, language, null, auth);
        } else {

          formOps.outputResponse(lang(language).msgMediaDeleted,
              '/mediaManagement.js', res, null, auth, language);

        }
      });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {
    exports.deleteMedia(auth, parameters, userData, res, req.language);
  });

};