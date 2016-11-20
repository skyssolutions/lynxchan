'use strict';

var settingsHandler = require('../settingsHandler');
var debug = require('../kernel').debug();
var miscOps = require('../engine/miscOps');
var fs = require('fs');
var captchaOps = require('../engine/captchaOps');
var formOps = require('../engine/formOps');
var gridFsHandler = require('../engine/gridFsHandler');

function showCaptcha(req, captchaData, res) {

  var cookies = [ {
    field : 'captchaid',
    value : captchaData._id,
    path : '/'
  }, {
    field : 'captchaexpiration',
    value : captchaData.expiration.toUTCString(),
    path : '/'
  } ];

  gridFsHandler.outputFile(captchaData._id + '.jpg', req, res,
      function streamedFile(error) {
        if (error) {

          if (settingsHandler.getGeneralSettings().verbose) {
            console.log(error);
          }

          if (debug) {
            throw error;
          }

          formOps.outputError(error, 500, res, req.language);

        }
      }, cookies);
}

exports.process = function(req, res) {

  var verbose = settingsHandler.getGeneralSettings().verbose;

  captchaOps.checkForCaptcha(req, function checked(error, captchaData) {

    if (error) {

      if (verbose) {
        console.log(error);
      }

      if (debug) {
        throw error;
      }

      formOps.outputError(error, 500, res, req.language);
    } else if (!captchaData) {
      if (verbose) {
        console.log('No captcha found');
      }

      captchaOps.generateCaptcha(function(error, captchaData) {

        if (error) {

          if (verbose) {
            console.log(error);
          }

          if (debug) {
            throw error;
          }

          formOps.outputError(error, 500, res, req.language);
        } else {
          showCaptcha(req, captchaData, res);
        }
      });
    } else {
      showCaptcha(req, captchaData, res);
    }
  });
};