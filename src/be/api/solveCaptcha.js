'use strict';

var apiOps = require('../engine/apiOps');
var captchaOps = require('../engine/captchaOps');

exports.process = function(req, res) {

  apiOps.getAnonJsonData(req, res, function gotData(auth, parameters) {

    // style exception, too simple
    captchaOps.solveCaptcha(parameters, function solvedCaptcha(error) {
      if (error) {
        apiOps.outputError(error, res);
      } else {
        apiOps.outputResponse(null, null, 'ok', res);
      }

    });

  });
  // style exception, too simple

};