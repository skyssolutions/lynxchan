'use strict';

var settings = require('../data/settingsRelation.json');
var formOps = require('../engine/formOps');
var lang = require('../engine/langOps').languagePack;
var miscOps = require('../engine/miscOps');

exports.processArray = function(rawParam) {

  var parts = rawParam.trim().split(',');

  var newArray = [];

  for (var j = 0; j < parts.length; j++) {

    var processedPart = parts[j].trim();

    if (processedPart.length) {
      newArray.push(processedPart);
    }

  }

  return newArray;

};

exports.changeGlobalSettings = function(userData, parameters, res, auth,
    language, json) {

  for (var i = 0; i < settings.length; i++) {

    var setting = settings[i];

    if (setting.type !== 'array') {
      continue;
    }

    var param = setting.setting;

    var rawParam = parameters[param];

    if (!rawParam) {
      parameters[param] = [];
      continue;
    }

    parameters[param] = exports.processArray(rawParam);

  }

  miscOps.setGlobalSettings(userData, language, parameters,
      function changedGlobalSettings(error) {

        if (error) {
          formOps.outputError(error, 500, res, language, json, auth);
        } else {
          formOps.outputResponse(json ? 'ok'
              : lang(language).msgSavedGlobalSettings, json ? null
              : '/globalSettings.js', res, null, auth, language, json);
        }

      });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {
    exports.changeGlobalSettings(userData, parameters, res, auth, req.language,
        formOps.json(req));
  });

};