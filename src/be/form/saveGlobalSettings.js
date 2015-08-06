'use strict';

var formOps = require('../engine/formOps');
var lang = require('../engine/langOps').languagePack();
var miscOps = require('../engine/miscOps');

function changeGlobalSettings(userData, parameters, res) {

  miscOps.setGlobalSettings(userData, parameters,
      function changedGlobalSettings(error, newHash) {

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