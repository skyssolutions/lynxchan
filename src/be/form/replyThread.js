'use strict';

var formOps = require('../engine/formOps');
var postingOps = require('../engine/postingOps');
var captchaOps = require('../engine/captchaOps');
var mandatoryParameters = [ 'message', 'boardUri', 'threadId' ];

function createPost(req, res, parameters, userData) {

  if (formOps.checkBlankParameters(parameters, mandatoryParameters, res)) {
    return;
  }

  formOps.checkForBan(req, parameters.boardUri, res,
      function checkedBan(error) {

        if (error) {
          formOps.outputError(error, 500, res);
        } else {

          // style exception, too simple

          postingOps.newPost(req, userData, parameters, function postCreated(
              error, id) {
            if (error) {
              formOps.outputError(error, 500, res);
            } else {
              var redirectLink = '../' + parameters.boardUri;
              redirectLink += '/res/' + parameters.threadId + '.html#' + id;
              formOps.outputResponse('Post created', redirectLink, res);
            }
          });
          // style exception, too simple

        }

      });

}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {

    var cookies = formOps.getCookies(req);

    // style exception, too simple
    captchaOps.attemptCaptcha(cookies.captchaId, parameters.captcha,
        function attemptedCaptcha(error) {
          if (error) {
            formOps.outputError(error, 500, res);
          } else {
            createPost(req, res, parameters, userData);
          }
        });
    // style exception, too simple
  }, true);

};