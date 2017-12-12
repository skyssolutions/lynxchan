'use strict';

var formOps = require('../engine/formOps');
var boardOps = require('../engine/boardOps').meta;
var lang = require('../engine/langOps').languagePack;
var mandatoryParameters = [ 'boardUri' ];

exports.setBoardSpecialSettings = function(userData, parameters, res, auth,
    language) {

  if (formOps.checkBlankParameters(parameters, mandatoryParameters, res,
      language)) {
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
          formOps.outputError(error, 500, res, language);
        } else {
          var redirect = '/boardModeration.js?boardUri=' + parameters.boardUri;

          formOps.outputResponse(lang(language).msgBoardSpecialSettingsSaved,
              redirect, res, null, auth, language);
        }

      });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {
    exports.setBoardSpecialSettings(userData, parameters, res, auth,
        req.language);
  });

};
