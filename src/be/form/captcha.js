'use strict';

var settingsHandler = require('../settingsHandler');
var miscOps = require('../engine/miscOps');
var captchaOps = require('../engine/captchaOps');
var formOps = require('../engine/formOps');

exports.showCaptcha = function(captchaData, res) {

  res.writeHead(302, miscOps.getHeader(null, null, [ [ 'Location',
      '/.global/captchas/' + captchaData._id ] ], [ {
    field : 'captchaid',
    value : captchaData._id,
    expiration : captchaData.expiration,
    path : '/'
  }, {
    field : 'captchaexpiration',
    value : captchaData.expiration.toUTCString(),
    path : '/'
  } ]));

  res.end();

};

exports.process = function(req, res) {

  var json = formOps.json(req);

  var settings = settingsHandler.getGeneralSettings();

  var verbose = settings.verbose || settings.verboseMisc;

  captchaOps.checkForCaptcha(req, function checked(error, captchaData) {

    if (error) {

      if (verbose) {
        console.log(error);
      }

      formOps.outputError(error, 500, res, req.language, json);
    } else if (!captchaData) {
      if (verbose) {
        console.log('No captcha found');
      }

      captchaOps.generateCaptcha(function(error, captchaData) {

        if (error) {

          if (verbose) {
            console.log(error);
          }

          formOps.outputError(error, 500, res, req.language, json);
        } else {
          exports.showCaptcha(captchaData, res);
        }
      });
    } else {
      exports.showCaptcha(captchaData, res);
    }
  });
};