'use strict';

var mongo = require('mongodb');
var ObjectID = mongo.ObjectId;
var captchas = require('../db').captchas();
var captchaOps = require('../engine/captchaOps');
var formOps = require('../engine/formOps');
var url = require('url');
var miscOps = require('../engine/miscOps');
var domManipulator = require('../engine/domManipulator').dynamicPages.miscPages;

exports.outputInfo = function(captchaData, parameters, res, req) {

  var string = captchaData._id + captchaData.session;

  if (parameters.json) {
    formOps.outputResponse('ok', string, res, null, null, null, true);
  } else {

    formOps.dynamicPage(res, domManipulator.noCookieCaptcha(parameters, string,
        req.language));
  }

};

exports.process = function(req, res) {

  var parameters = url.parse(req.url, true).query;

  captchaOps.generateCaptcha(req,
      function generatedCaptcha(error, captchaData) {
        if (error) {
          return formOps.outputError(error, 500, res, req.language,
              parameters.json);
        }

        if (!parameters.solvedCaptcha) {
          return exports.outputInfo(captchaData, parameters, res, req);
        }

        try {
          var captchaId = new ObjectID(parameters.solvedCaptcha
              .substring(0, 24));
        } catch (error) {
          delete parameters.solvedCaptcha;
          return exports.outputInfo(captchaData, parameters, res, req);
        }

        captchas.findOne({
          _id : captchaId,
          session : parameters.solvedCaptcha.substr(24),

        }, function gotCaptcha(error, captcha) {

          if (captcha) {
            parameters.solvedCaptcha = captcha._id + captcha.session;
          } else {
            delete parameters.solvedCaptcha;
          }

          exports.outputInfo(captchaData, parameters, res, req);

        });

      });

};