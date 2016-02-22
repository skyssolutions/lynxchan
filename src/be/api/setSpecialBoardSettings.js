'use strict';

var apiOps = require('../engine/apiOps');
var boardOps = require('../engine/boardOps').meta;
var mandatoryParameters = [ 'boardUri' ];
var possibleSettings = boardOps.getValidSpecialSettings();

function setBoardSpecialSettings(auth, userData, parameters, res) {

  if (apiOps.checkBlankParameters(parameters, mandatoryParameters, res)) {
    return;
  }

  parameters.specialSettings = parameters.specialSettings || [];

  var desiredSettings = [];

  for (var i = 0; i < parameters.specialSettings.length; i++) {

    var setting = parameters.specialSettings[i];

    if (possibleSettings.indexOf(setting) > -1) {
      desiredSettings.push(setting);
    }

  }

  parameters.specialSettings = desiredSettings;

  boardOps.setSpecialSettings(userData, parameters,
      function specialSettingsSaved(error) {
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
    setBoardSpecialSettings(auth, userData, parameters, res);
  });

};
