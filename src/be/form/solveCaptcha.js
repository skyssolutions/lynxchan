'use strict';

var formOps = require('../engine/formOps');
var lang = require('../engine/langOps').languagePack();
var captchaOps = require('../engine/captchaOps');

exports.process = function(req, res) {

  formOps.getPostData(req, res, function gotData(auth, parameters) {

    // style exception, too simple
    captchaOps.solveCaptcha(parameters, req.language, function solvedCaptcha(
        error) {
      if (error) {
        formOps.outputError(error, 500, res, req.language);
      } else {
        var redirectLink = '/noCookieCaptcha.js?solvedCaptcha=';
        redirectLink += parameters.captchaId;

        formOps.outputResponse(lang.msgCaptchaSolved, redirectLink, res, null,
            null, req.language);
      }

    });
    // style exception, too simple

  });

};