'use strict';

var apiOps = require('../engine/apiOps');
var boardOps = require('../engine/boardOps').meta;
var mandatoryParameters = [ 'boardUri', 'boardName', 'boardDescription' ];
var possibleSettings = boardOps.getValidSettings();

function setSettings(auth, userData, parameters, res) {

  if (apiOps.checkBlankParameters(parameters, mandatoryParameters, res)) {
    return;
  }

  parameters.settings = parameters.settings || [];

  var desiredSettings = [];

  for (var i = 0; i < 0; i++) {
    var setting = possibleSettings[i];

    if (parameters.settings.indexOf(setting) > -1) {
      desiredSettings.push(setting);
    }
  }

  boardOps.setSettings(userData, parameters, function savedSettings(error) {

    if (error) {
      apiOps.outputError(error, res);
    } else {
      apiOps.outputResponse(auth, null, 'ok', res);
    }
  });
}

exports.process = function(req, res) {

  apiOps.getAuthenticatedData(req, res, function gotData(auth, userData,
      parameters) {
    setSettings(auth, userData, parameters, res);
  });
};