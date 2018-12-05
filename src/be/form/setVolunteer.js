'use strict';

var formOps = require('../engine/formOps');
var lang = require('../engine/langOps').languagePack;
var boardOps = require('../engine/boardOps').meta;
var mandatoryParameters = [ 'boardUri', 'login' ];

exports.setVolunteer = function(userData, param, res, auth, language, json) {

  if (formOps.checkBlankParameters(param, mandatoryParameters, res, language,
      json)) {
    return;
  }

  param.add = param.add === 'true';

  boardOps.setVolunteer(userData, param, language,
      function setVolunteer(error) {

        if (error) {
          formOps.outputError(error, 500, res, language, json, auth);
        } else {
          formOps.outputResponse(json ? 'ok'
              : (param.add ? lang(language).msgVolunteerAdded
                  : lang(language).msgVolunteerRemoved), json ? null
              : '/boardManagement.js?boardUri=' + param.boardUri, res, null,
              auth, language, json);
        }

      });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {
    exports.setVolunteer(userData, parameters, res, auth, req.language, formOps
        .json(req));
  });

};