'use strict';

var apiOps = require('../engine/apiOps');
var boardOps = require('../engine/boardOps').meta;
var mandatoryParameters = [ 'boardUri', 'boardName', 'boardDescription' ];
var possibleSettings = boardOps.getValidSettings();

exports.setSettings = function(auth, userData, parameters, res, language) {

  if (apiOps.checkBlankParameters(parameters, mandatoryParameters, res)) {
    return;
  }

  parameters.settings = parameters.settings || [];

  var desiredSettings = [];

  for (var i = 0; i < possibleSettings.length; i++) {

    var setting = parameters.settings[i];

    if (possibleSettings.indexOf(setting) > -1) {
      desiredSettings.push(setting);
    }
  }

  parameters.settings = desiredSettings;

  boardOps.setSettings(userData, parameters, language, function savedSettings(
      error) {

    if (error) {
      apiOps.outputError(error, res);
    } else {
      apiOps.outputResponse(auth, null, 'ok', res);
    }
  });
};

exports.process = function(req, res) {

  apiOps.getAuthenticatedData(req, res, function gotData(auth, userData,
      parameters) {
    exports.setSettings(auth, userData, parameters, res, req.language);
  });
};