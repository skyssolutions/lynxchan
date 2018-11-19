'use strict';

var formOps = require('../engine/formOps');
var bypassOps = require('../engine/bypassOps');
var postingOps = require('../engine/postingOps').post;
var captchaOps = require('../engine/captchaOps');
var lang = require('../engine/langOps').languagePack;
var mandatoryParameters = [ 'boardUri', 'threadId' ];

exports.createPost = function(req, userData, parameters, captchaId, res, auth) {

  postingOps.newPost(req, userData, parameters, captchaId,
      function postCreated(error, id) {
        if (error) {
          formOps.outputError(error, 500, res, req.language);
        } else {

          var redirectLink = '/' + parameters.boardUri;
          redirectLink += '/res/' + parameters.threadId;
          redirectLink += '.html#' + id;

          res.writeHead(302, {
            'Location' : redirectLink
          });

          res.end();

        }
      });

};

exports.checkBans = function(req, res, parameters, userData, captchaId, auth) {

  if (formOps.checkBlankParameters(parameters, mandatoryParameters, res,
      req.language)) {
    return;
  }

  formOps.checkForBan(req, parameters.boardUri, res,
      function checkedBan(error) {

        if (error) {
          formOps.outputError(error, 500, res, req.language);
        } else {

          // style exception, too simple
          formOps.checkForHashBan(parameters, req, res,
              function checkedHashBans(error) {
                if (error) {
                  formOps.outputError(error, 500, res, req.language);
                } else {
                  exports.createPost(req, userData, parameters, captchaId, res,
                      auth);
                }
              }, auth);
          // style exception, too simple

        }

      }, auth);

};

exports.useBypass = function(req, res, parameters, userData, captchaId,
    bypassId, auth) {

  bypassOps.useBypass(bypassId, req, function usedBypass(error) {

    if (error) {
      formOps.outputError(error, 500, res, req.language);
    } else {
      exports.checkBans(req, res, parameters, userData, captchaId, auth);
    }
  });
};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {

    var cookies = formOps.getCookies(req);
    exports.useBypass(req, res, parameters, userData, cookies.captchaid,
        cookies.bypass, auth);
  }, true);

};