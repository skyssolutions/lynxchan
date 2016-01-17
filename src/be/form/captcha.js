'use strict';

var settingsHandler = require('../settingsHandler');
var debug = require('../kernel').debug();
var miscOps = require('../engine/miscOps');
var fs = require('fs');
var captchaOps = require('../engine/captchaOps');
var formOps = require('../engine/formOps');
var gridFsHandler = require('../engine/gridFsHandler');

function showCaptcha(req, id, res, cookies) {
  gridFsHandler.outputFile(id + '.jpg', req, res, function streamedFile(error) {
    if (error) {

      if (settingsHandler.getGeneralSettings().verbose) {
        console.log(error);
      }

      if (debug) {
        throw error;
      }

      formOps.outputError(error, 500, res);

    }
  }, cookies);
}

exports.process = function(req, res) {

  var verbose = settingsHandler.getGeneralSettings().verbose;

  captchaOps.checkForCaptcha(req, function checked(error, id) {

    if (error) {

      if (verbose) {
        console.log(error);
      }

      if (debug) {
        throw error;
      }

      formOps.outputError(error, 500, res);
    } else if (!id) {
      if (verbose) {
        console.log('No captcha found');
      }

      captchaOps.generateCaptcha(function(error, id) {

        if (error) {

          if (verbose) {
            console.log(error);
          }

          if (debug) {
            throw error;
          }

          formOps.outputError(error, 500, res);
        } else {
          showCaptcha(req, id, res, [ {
            field : 'captchaid',
            value : id,
            path : '/'
          } ]);
        }
      });
    } else {
      showCaptcha(req, id, res);
    }
  });
};