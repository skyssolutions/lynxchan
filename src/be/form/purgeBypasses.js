'use strict';

var formOps = require('../engine/formOps');
var bypassOps = require('../engine/bypassOps');
var languageOps = require('../engine/langOps');
var lang = languageOps.languagePack;

exports.purgeBypasses = function(auth, userData, parameters, res, language,
    json) {

  bypassOps.purgeBypasses(userData, parameters, language, function(error) {
    if (error) {
      formOps.outputError(error, 500, res, language, json, auth);
    } else {
      formOps
          .outputResponse(json ? 'ok' : lang(language).msgBypassesPurged,
              json ? null : '/globalManagement.js', res, null, auth, language,
              json);
    }
  });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {
    exports.purgeBypasses(auth, userData, parameters, res, req.language,
        formOps.json(req));
  });

};