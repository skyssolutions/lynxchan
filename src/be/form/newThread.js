'use strict';

var formOps = require('../engine/formOps');
var postingOps = require('../engine/postingOps');
var captchaOps = require('../engine/captchaOps');
var mandatoryParameters = [ 'message', 'boardUri' ];

function createThread(req, res, parameters, userData) {

  if (formOps.checkBlankParameters(parameters, mandatoryParameters, res)) {
    return;
  }

  formOps.checkForBan(req, parameters.boardUri, res,
      function checkedBan(error) {

        if (error) {
          formOps.outputError(error, 500, res);
        } else {

          // style exception, too simple
          postingOps.newThread(req, userData, parameters,
              function threadCreated(error, id) {
                if (error) {
                  formOps.outputError(error, 500, res);
                } else {
                  var redirectLink = '../' + parameters.boardUri;
                  redirectLink += '/res/' + id + '.html';
                  formOps.outputResponse('Thread created', redirectLink, res);
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
            createThread(req, res, parameters, userData);
          }
        });
    // style exception, too simple

  }, true);

};