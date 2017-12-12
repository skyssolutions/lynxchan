'use strict';

var settingsHandler = require('../settingsHandler');
var debug = require('../kernel').debug();
var fs = require('fs');
var captchaOps = require('../engine/captchaOps');
var formOps = require('../engine/formOps');
var gridFsHandler = require('../engine/gridFsHandler');

exports.showCaptcha = function(req, captchaData, res) {

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

          var settings = settingsHandler.getGeneralSettings();

          if (debug) {
            throw error;
          } else if (settings.verboseMisc || settings.verbose) {
            console.log(error);
          }

          formOps.outputError(error, 500, res, req.language);

        }
      }, cookies);
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
          exports.showCaptcha(req, captchaData, res);
        }
      });
    } else {
      exports.showCaptcha(req, captchaData, res);
    }
  });
};