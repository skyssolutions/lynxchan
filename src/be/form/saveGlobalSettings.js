'use strict';

var formOps = require('../engine/formOps');
var lang = require('../engine/langOps').languagePack;
var miscOps = require('../engine/miscOps');
var toSanitize = [ 'acceptedMimes', 'addons', 'slaves' ];

exports.changeGlobalSettings = function(userData, parameters, res, auth,
    language, json) {

  for (var i = 0; i < toSanitize.length; i++) {

    var param = toSanitize[i];

    var rawParam = parameters[param];

    if (!rawParam) {
      parameters[param] = [];
      continue;
    }

    var parts = rawParam.trim().split(',');

    var newArray = [];

    for (var j = 0; j < parts.length; j++) {

      var processedPart = parts[j].trim();

      if (processedPart.length) {
        newArray.push(processedPart);
      }

    }

    parameters[param] = newArray;

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