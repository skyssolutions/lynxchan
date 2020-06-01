'use strict';

var formOps = require('../engine/formOps');
var lang = require('../engine/langOps').languagePack;
var archive = require('../engine/archiveOps');
var mandatoryParameters = [ 'threadId', 'boardUri' ];

exports.archiveThread = function(auth, parameters, userData, res, language,
    json) {

  if (formOps.checkBlankParameters(parameters, mandatoryParameters, res,
      language, json)) {
    return;
  }

  archive.archiveThread(language, parameters, userData,
      function archived(error) {

        if (error) {
          formOps.outputError(error, 500, res, language, json, auth);
        } else {

          var redirectLink = '/mod.js?boardUri=' + parameters.boardUri;
          redirectLink += '&threadId=' + parameters.threadId;

          formOps.outputResponse(
              json ? 'ok' : lang(language).msgThreadArchived, json ? null
                  : redirectLink, res, null, auth, language, json);

        }

      });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {
    exports.archiveThread(auth, parameters, userData, res, req.language,
        formOps.json(req));
  });
};