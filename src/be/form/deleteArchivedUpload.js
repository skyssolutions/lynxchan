'use strict';

var formOps = require('../engine/formOps');
var lang = require('../engine/langOps').languagePack();
var archive = require('../archive');
var mandatoryParameters = [ 'boardUri', 'filename' ];

function removeArchivedUpload(userData, parameters, res) {

  if (formOps.checkBlankParameters(parameters, mandatoryParameters, res)) {
    return;
  }

  archive.deleteUpload(userData, parameters, function reportClosed(error,
      global, board) {
    if (error) {
      formOps.outputError(error, 500, res);
    } else {

      formOps
          .outputResponse(lang.msgArchiveRemoved, '/archiveDeletion.js', res);
    }
  });

}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {

    removeArchivedUpload(userData, parameters, res);

  });

};