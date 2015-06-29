'use strict';

var boot = require('../boot');
var verbose = boot.getGeneralSettings().verbose;
var debug = boot.debug();
var miscOps = require('../engine/miscOps');
var fs = require('fs');
var captchaOps = require('../engine/captchaOps');
var formOps = require('../engine/formOps');
var gridFsHandler = require('../engine/gridFsHandler');

function showCaptch(req, id, res, cookies) {
  gridFsHandler.outputFile(id + '.jpg', req, res, function streamedFile(error) {
    if (error) {

      if (verbose) {
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
          showCaptch(req, id, res, [ {
            field : 'captchaid',
            value : id,
            path : '/'
          } ]);
        }

      });

    } else {
      showCaptch(req, id, res);
    }

  });

};