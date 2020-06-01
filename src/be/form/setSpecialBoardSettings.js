'use strict';

var formOps = require('../engine/formOps');
var boardOps = require('../engine/boardOps').meta;
var lang = require('../engine/langOps').languagePack;
var mandatoryParameters = [ 'boardUri' ];

exports.setBoardSpecialSettings = function(userData, parameters, res, auth,
    language, json) {

  if (formOps.checkBlankParameters(parameters, mandatoryParameters, res,
      language, json)) {
    return;
  }

  var desiredSettings = [];

  for (var i = 0; i < boardOps.validSpecialSettings.length; i++) {

    var setting = boardOps.validSpecialSettings[i];

    if (parameters[setting]) {
      desiredSettings.push(setting);
    }

  }

  parameters.specialSettings = desiredSettings;

  boardOps.setSpecialSettings(userData, parameters, language,
      function specialSettingsSaved(error) {
        if (error) {
          formOps.outputError(error, 500, res, language, json, auth);
        } else {
          var redirect = '/boardModeration.js?boardUri=' + parameters.boardUri;

          formOps.outputResponse(json ? 'ok'
              : lang(language).msgBoardSpecialSettingsSaved, json ? null
              : redirect, res, null, auth, language, json);
        }

      });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {
    exports.setBoardSpecialSettings(userData, parameters, res, auth,
        req.language, formOps.json(req));
  });

};
