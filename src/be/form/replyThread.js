'use strict';

var formOps = require('../engine/formOps');
var bypassOps = require('../engine/bypassOps');
var postingOps = require('../engine/postingOps').post;
var captchaOps = require('../engine/captchaOps');
var lang = require('../engine/langOps').languagePack;
var mandatoryParameters = [ 'boardUri', 'threadId' ];

exports.createPost = function(json, req, userData, parameters, captchaId, res,
    auth) {

  postingOps.newPost(req, userData, parameters, captchaId,
      function postCreated(error, id) {
        if (error) {
          formOps.outputError(error, 500, res, req.language, json, auth);
        } else {

          if (json) {
            formOps.outputResponse('ok', id, res, null, auth, null, true);
            return;
          }

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

exports.checkBans = function(json, req, res, parameters, userData, captchaId,
    auth) {

  if (formOps.checkBlankParameters(parameters, mandatoryParameters, res,
      req.language, json)) {
    return;
  }

  formOps.checkForBan(req, parameters.boardUri, res,
      function checkedBan(error) {

        if (error) {
          formOps.outputError(error, 500, res, req.language, json, auth);
        } else {

          // style exception, too simple
          formOps.checkForHashBan(parameters, req, res,
              function checkedHashBans(error) {
                if (error) {
                  formOps
                      .outputError(error, 500, res, req.language, json, auth);
                } else {
                  exports.createPost(json, req, userData, parameters,
                      captchaId, res, auth);
                }
              }, auth, json);
          // style exception, too simple

        }

      }, auth, json);

};

exports.useBypass = function(json, req, res, parameters, userData, captchaId,
    bypassId, auth) {

  bypassOps.useBypass(bypassId, req, function usedBypass(error) {

    if (error) {
      formOps.outputError(error, 500, res, req.language, json, auth);
    } else {
      exports.checkBans(json, req, res, parameters, userData, captchaId, auth);
    }
  });
};

exports.process = function(req, res) {

  var json = formOps.json(req);

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {

    var cookies = formOps.getCookies(req);
    exports.useBypass(json, req, res, parameters, userData, cookies.captchaid,
        cookies.bypass, auth);
  }, true);

};