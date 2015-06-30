'use strict';

var formOps = require('../engine/formOps');
var captchaOps = require('../engine/captchaOps');

exports.process = function(req, res) {

  formOps.getPostData(req, res, function gotData(auth, parameters) {

    // style exception, too simple
    captchaOps.solveCaptcha(parameters, function solvedCaptcha(error) {
      if (error) {
        formOps.outputError(error, 500, res);
      } else {
        var redirectLink = '/noCookieCaptcha.js?solvedCaptcha=';
        redirectLink += parameters.captchaId;

        formOps.outputResponse('Captcha solved', redirectLink, res);
      }

    });

  });
  // style exception, too simple

};