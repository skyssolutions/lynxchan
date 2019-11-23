'use strict';

var formOps = require('../engine/formOps');
var boardOps = require('../engine/boardOps').meta;
var lang = require('../engine/langOps').languagePack;
var mandatoryParameters = [ 'boardUri', 'boardName' ];

exports.setBoardSettings = function(userData, parameters, res, auth, language,
    json) {

  if (formOps.checkBlankParameters(parameters, mandatoryParameters, res,
      language, json)) {
    return;
  }

  var desiredSettings = [];
  var possibleSettings = boardOps.getValidSettings();

  for (var i = 0; i < possibleSettings.length; i++) {

    var setting = possibleSettings[i];

    if (parameters[setting]) {
      desiredSettings.push(setting);
    }

  }

  parameters.settings = desiredSettings;

  if (parameters.tags) {
    parameters.tags = parameters.tags.split(',');
  }

  if (parameters.acceptedMimes) {
    parameters.acceptedMimes = parameters.acceptedMimes.split(',');
  }

  boardOps.setSettings(userData, parameters, language, function settingsSaved(
      error) {
    if (error) {
      formOps.outputError(error, 500, res, language, json, auth);
    } else {

      formOps.outputResponse(
          json ? 'ok' : lang(language).msgBoardSettingsSaved, json ? null
              : '/boardManagement.js?boardUri=' + parameters.boardUri, res,
          null, auth, language, json);

    }

  });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {

    exports.setBoardSettings(userData, parameters, res, auth, req.language,
        formOps.json(req));

  });

};