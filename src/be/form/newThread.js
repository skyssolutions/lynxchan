'use strict';

var formOps = require('../engine/formOps');
var bypassOps = require('../engine/bypassOps');
var postingOps = require('../engine/postingOps').thread;
var captchaOps = require('../engine/captchaOps');
var lang = require('../engine/langOps').languagePack;
var mandatoryParameters = [ 'message', 'boardUri' ];

exports.createThread = function(req, user, parameters, captchaId, res, auth) {

  postingOps.newThread(req, user, parameters, captchaId,
      function threadCreated(error, id) {
        if (error) {
          formOps.outputError(error, 500, res, req.language, null, auth);
        } else {

          var redirectLink = '/' + parameters.boardUri;
          redirectLink += '/res/' + id + '.html';

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
          formOps.outputError(error, 500, res, req.language, null, auth);
        } else {

          // style exception, too simple
          formOps.checkForHashBan(parameters, req, res,
              function checkedHashBans(error) {
                if (error) {
                  formOps
                      .outputError(error, 500, res, req.language, null, auth);
                } else {
                  exports.createThread(req, userData, parameters, captchaId,
                      res, auth);
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
      formOps.outputError(error, 500, res, req.language, null, auth);
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