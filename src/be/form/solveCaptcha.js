'use strict';

var formOps = require('../engine/formOps');
var lang = require('../engine/langOps').languagePack;
var captchaOps = require('../engine/captchaOps');

exports.process = function(req, res) {

  formOps.getPostData(req, res, function gotData(auth, parameters) {

    // style exception, too simple
    captchaOps.solveCaptcha(parameters, req.language, function solvedCaptcha(
        error) {

      var json = formOps.json(req);

      if (error) {
        formOps.outputError(error, 500, res, req.language, json);
      } else {
        var redirectLink = '/noCookieCaptcha.js?solvedCaptcha=';
        redirectLink += encodeURIComponent(parameters.captchaId);

        formOps.outputResponse(json ? 'ok'
            : lang(req.language).msgCaptchaSolved, json ? null : redirectLink,
            res, null, null, req.language, json);
      }

    });
    // style exception, too simple

  });

};