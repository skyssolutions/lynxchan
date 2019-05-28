'use strict';

var formOps = require('../engine/formOps');
var lang = require('../engine/langOps').languagePack;
var mandatoryParameters = [ 'boardUri', 'boardName' ];
var boardOps = require('../engine/boardOps').meta;

exports.createBoard = function(userData, parameters, res, captchaId, auth,
    language, json) {

  if (formOps.checkBlankParameters(parameters, mandatoryParameters, res,
      language, json)) {
    return;
  }

  boardOps.createBoard(captchaId, parameters, userData, language,
      function boardCreated(error) {
        if (error) {
          formOps.outputError(error, 500, res, language, json, auth);
        } else {

          formOps.outputResponse(json ? 'ok' : lang(language).msgBoardCreated,
              json ? null : '/' + parameters.boardUri + '/', res, null, auth,
              language, json);
        }
      });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {

    var cookies = formOps.getCookies(req);

    exports.createBoard(userData, parameters, res, cookies.captchaid, auth,
        req.language, formOps.json(req));

  });

};