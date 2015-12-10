'use strict';

var formOps = require('../engine/formOps');
var lang = require('../engine/langOps').languagePack();
var archive = require('../archive');
var mandatoryParameters = [ 'boardUri', 'threadId' ];

function removeArchivedThread(userData, parameters, res, auth) {

  if (formOps.checkBlankParameters(parameters, mandatoryParameters, res)) {
    return;
  }

  archive.deleteThread(userData, parameters, function reportClosed(error) {
    if (error) {
      formOps.outputError(error, 500, res);
    } else {

      formOps.outputResponse(lang.msgArchiveRemoved, '/archiveDeletion.js',
          res, null, auth);
    }
  });

}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {

    removeArchivedThread(userData, parameters, res, auth);

  });

};