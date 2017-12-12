'use strict';

var formOps = require('../engine/formOps');
var boardOps = require('../engine/boardOps').meta;
var lang = require('../engine/langOps').languagePack;
var mandatoryParameters = [ 'boardUri', 'boardName', 'boardDescription' ];
var possibleSettings = boardOps.getValidSettings();

exports.setBoardSettings = function(userData, parameters, res, auth, language) {

  if (formOps.checkBlankParameters(parameters, mandatoryParameters, res,
      language)) {
    return;
  }

  var desiredSettings = [];

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
      formOps.outputError(error, 500, res, language);
    } else {
      var redirect = '/boardManagement.js?boardUri=' + parameters.boardUri;

      formOps.outputResponse(lang(language).msgBoardSettingsSaved, redirect,
          res, null, auth, language);
    }

  });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {

    exports.setBoardSettings(userData, parameters, res, auth, req.language);

  });

};