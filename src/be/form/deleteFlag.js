'use strict';

var formOps = require('../engine/formOps');
var boardOps = require('../engine/boardOps').flags;
var lang = require('../engine/langOps').languagePack;

exports.deleteFlag = function(parameters, userData, res, auth, language, json) {

  boardOps.deleteFlag(userData, parameters.flagId, language,
      function deletedFlag(error, board) {
        if (error) {
          formOps.outputError(error, 500, res, language, json, auth);
        } else {

          var url = '/flags.js?boardUri=' + board;

          formOps.outputResponse(json ? 'ok' : lang(language).msgFlagDeleted,
              json ? null : url, res, null, auth, language, json);
        }
      });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {
    exports.deleteFlag(parameters, userData, res, auth, req.language, formOps
        .json(req));
  });

};