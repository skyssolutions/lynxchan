'use strict';

var formOps = require('../engine/formOps');
var lang = require('../engine/langOps').languagePack;
var mandatoryParameters = [ 'boardUri', 'boardName', 'boardDescription' ];
var boardOps = require('../engine/boardOps').meta;

exports.createBoard = function(userData, parameters, res, captchaId, auth,
    language) {

  if (formOps.checkBlankParameters(parameters, mandatoryParameters, res,
      language)) {
    return;
  }

  boardOps.createBoard(captchaId, parameters, userData, language,
      function boardCreated(error) {
        if (error) {
          formOps.outputError(error, 500, res, language, null, auth);
        } else {
          var redirectLink = '/' + parameters.boardUri + '/';

          formOps.outputResponse(lang(language).msgBoardCreated, redirectLink,
              res, null, auth, language);
        }
      });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {

    var cookies = formOps.getCookies(req);

    exports.createBoard(userData, parameters, res, cookies.captchaid, auth,
        req.language);

  });

};