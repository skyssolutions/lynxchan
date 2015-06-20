'use strict';

var formOps = require('../engine/formOps');
var boardOps = require('../engine/boardOps');
var mandatoryParameters = [ 'boardUri', 'boardName', 'boardDescription' ];
var possibleSettings = [ {
  parameter : 'disableIds',
  setting : 'disableIds'
} ];

function setBoardSettings(userData, parameters, res) {

  if (formOps.checkBlankParameters(parameters, mandatoryParameters, res)) {
    return;
  }

  var desiredSettings = [];

  for (var i = 0; i < possibleSettings.length; i++) {

    var setting = possibleSettings[i];

    if (parameters[setting.parameter]) {
      desiredSettings.push(setting.setting);
    }

  }

  parameters.settings = desiredSettings;

  boardOps.setSettings(userData, parameters, function settingsSaved(error) {
    if (error) {
      formOps.outputError(error, 500, res);
    } else {
      var redirect = '/boardManagement.js?boardUri=' + parameters.boardUri;

      formOps.outputResponse('Settings saved', redirect, res);
    }

  });

}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {

    setBoardSettings(userData, parameters, res);

  });

};