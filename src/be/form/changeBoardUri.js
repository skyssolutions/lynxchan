'use strict';

var formOps = require('../engine/formOps');
var boardOps = require('../engine/boardOps').meta;
var languageOps = require('../engine/langOps');
var lang = languageOps.languagePack;

exports.changeBoardUri = function(auth, userData, parameters, res, language,
    json) {

  boardOps.changeBoardUri(userData, parameters, language, function(error) {
    if (error) {
      formOps.outputError(error, 500, res, language, json, auth);
    } else {
      formOps.outputResponse(json ? 'ok' : lang(language).msgUriChanged,
          json ? null : '/boardModeration.js?boardUri=' + parameters.newUri,
          res, null, auth, language, json);
    }
  });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {
    exports.changeBoardUri(auth, userData, parameters, res, req.language,
        formOps.json(req));
  });

};