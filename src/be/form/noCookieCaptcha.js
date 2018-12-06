'use strict';

var captchaOps = require('../engine/captchaOps');
var formOps = require('../engine/formOps');
var url = require('url');
var miscOps = require('../engine/miscOps');
var domManipulator = require('../engine/domManipulator').dynamicPages.miscPages;

exports.process = function(req, res) {

  var parameters = url.parse(req.url, true).query;

  captchaOps.generateCaptcha(function generatedCaptcha(error, captchaData) {
    if (error) {
      formOps.outputError(error, 500, res, req.language, parameters.json);
    } else {

      if (parameters.json) {
        formOps.outputResponse('ok', captchaData._id, res, null, null, null,
            true);
      } else {
        res.writeHead(200, miscOps.getHeader('text/html'));
        res.end(domManipulator.noCookieCaptcha(parameters, captchaData._id,
            req.language));
      }
    }

  });

};