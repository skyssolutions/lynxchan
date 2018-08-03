'use strict';

var settingsHandler = require('../settingsHandler');
var debug = require('../kernel').debug();
var captchaOps = require('../engine/captchaOps');
var formOps = require('../engine/formOps');

exports.showCaptcha = function(captchaData, res) {

  var expirationCookie = 'captchaexpiration=';
  expirationCookie += captchaData.expiration.toUTCString() + ';path=/';

  var header = [ [ 'Location', '/.global/captchas/' + captchaData._id ],
      [ 'Set-Cookie', 'captchaid=' + captchaData._id + ';path=/' ],
      [ 'Set-Cookie', expirationCookie ] ];

  res.writeHead(302, header);
  res.end();

};

exports.process = function(req, res) {

  var settings = settingsHandler.getGeneralSettings();

  var verbose = settings.verbose || settings.verboseMisc;

  captchaOps.checkForCaptcha(req, function checked(error, captchaData) {

    if (error) {

      if (debug) {
        throw error;
      } else if (verbose) {
        console.log(error);
      }

      formOps.outputError(error, 500, res, req.language);
    } else if (!captchaData) {
      if (verbose) {
        console.log('No captcha found');
      }

      captchaOps.generateCaptcha(function(error, captchaData) {

        if (error) {

          if (debug) {
            throw error;
          } else if (verbose) {
            console.log(error);
          }

          formOps.outputError(error, 500, res, req.language);
        } else {
          exports.showCaptcha(captchaData, res);
        }
      });
    } else {
      exports.showCaptcha(captchaData, res);
    }
  });
};