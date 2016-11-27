'use strict';

var apiOps = require('../engine/apiOps');
var miscOps = require('../engine/miscOps');
var toSanitize = [ 'acceptedMimes', 'addons', 'slaves' ];

function changeGlobalSettings(auth, userData, parameters, res, language) {

  for (var i = 0; i < toSanitize.length; i++) {

    var param = toSanitize[i];

    var receivedArray = parameters[param];

    if (!receivedArray) {
      parameters[param] = [];
      continue;
    }

    var newArray = [];

    for (var j = 0; j < receivedArray.length; j++) {

      var processedPart = receivedArray[j].toString().trim();

      if (processedPart.length) {
        newArray.push(processedPart);
      }
    }

    parameters[param] = newArray;
  }

  miscOps.setGlobalSettings(userData, language, parameters,
      function changedGlobalSettings(error) {
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
    changeGlobalSettings(auth, userData, parameters, res, req.language);
  });
};