'use strict';

var formOps = require('../engine/formOps');
var lang = require('../engine/langOps').languagePack();
var mediaHandler = require('../engine/mediaHandler');

function deleteMedia(auth, parameters, userData, res) {

  var selectedIdentifiers = [];

  for ( var key in parameters) {
    if (parameters.hasOwnProperty(key)) {
      selectedIdentifiers.push(key);
    }
  }

  mediaHandler.deleteFiles(selectedIdentifiers, userData,
      function deletedFiles(error) {

        if (error) {
          formOps.outputError(error, 500, res);
        } else {

          formOps.outputResponse(lang.msgMediaDeleted, '/mediaManagement.js',
              res, null, auth);

        }
      });

}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {

    deleteMedia(auth, parameters, userData, res);

  });

};