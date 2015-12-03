'use strict';

var formOps = require('../engine/formOps');
var lang = require('../engine/langOps').languagePack();
var miscOps = require('../engine/miscOps');
var toSanitize = [ 'captchaFonts', 'acceptedMimes', 'addons' ];

function changeGlobalSettings(userData, parameters, res) {

  for (var i = 0; i < toSanitize.length; i++) {

    var param = toSanitize[i];

    var rawParam = parameters[param];

    if (!rawParam) {
      parameters[param] = [];
      continue;
    }

    var parts = rawParam.toString().trim().split(',');

    var newArray = [];

    for (var j = 0; j < parts.length; j++) {

      var processedPart = parts[j].trim();

      if (processedPart.length) {
        newArray.push(processedPart);
      }

    }

    parameters[param] = newArray;

  }

  miscOps.setGlobalSettings(userData, parameters,
      function changedGlobalSettings(error) {

        if (error) {
          formOps.outputError(error, 500, res);
        } else {
          formOps.outputResponse(lang.msgSavedGlobalSettings,
              '/globalSettings.js', res);
        }

      });

}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {
    changeGlobalSettings(userData, parameters, res);
  });

};