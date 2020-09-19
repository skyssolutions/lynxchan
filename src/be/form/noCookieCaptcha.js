'use strict';

var captchaOps = require('../engine/captchaOps');
var formOps = require('../engine/formOps');
var url = require('url');
var miscOps = require('../engine/miscOps');
var domManipulator = require('../engine/domManipulator').dynamicPages.miscPages;

exports.process = function(req, res) {

  var parameters = url.parse(req.url, true).query;

  captchaOps.generateCaptcha(req,
      function generatedCaptcha(error, captchaData) {
        if (error) {
          formOps.outputError(error, 500, res, req.language, parameters.json);
        } else {

          var string = captchaData._id + captchaData.session;

          if (parameters.json) {
            formOps.outputResponse('ok', string, res, null, null, null, true);
          } else {

            formOps.dynamicPage(res, domManipulator.noCookieCaptcha(parameters,
                string, req.language));
          }
        }

      });

};