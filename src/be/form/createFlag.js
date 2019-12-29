'use strict';

var formOps = require('../engine/formOps');
var lang = require('../engine/langOps').languagePack;
var boardOps = require('../engine/boardOps').flags;
var mandatoryParameters = [ 'flagName', 'boardUri' ];

exports.createFlag = function(parameters, userData, res, auth, language, json) {

  if (formOps.checkBlankParameters(parameters, mandatoryParameters, res,
      language, json)) {
    return;
  }

  boardOps.createFlag(userData, parameters, language, function createdFlag(
      error, id) {
    if (error) {
      formOps.outputError(error, 500, res, language, json, auth);
    } else {

      var url = '/flags.js?boardUri=' + parameters.boardUri;

      formOps.outputResponse(json ? 'ok' : lang(language).msgFlagCreated,
          json ? id : url, res, null, auth, language, json);
    }
  });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {

    // style exception, too simple
    formOps.validateMimes(parameters, parameters.files,
        function(error) {

          var json = formOps.json(req);

          if (error) {
            formOps.outputError(error, 500, res, req.language, json, auth);
          } else {
            exports.createFlag(parameters, userData, res, auth, req.language,
                json);
          }

        });
    // style exception, too simple

  });

};