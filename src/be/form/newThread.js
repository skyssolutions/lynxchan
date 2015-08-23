'use strict';

var formOps = require('../engine/formOps');
var postingOps = require('../engine/postingOps').thread;
var captchaOps = require('../engine/captchaOps');
var lang = require('../engine/langOps').languagePack();
var mandatoryParameters = [ 'message', 'boardUri' ];

function createThread(req, res, parameters, userData, captchaId) {

  if (formOps.checkBlankParameters(parameters, mandatoryParameters, res)) {
    return;
  }

  formOps.checkForBan(req, parameters.boardUri, res,
      function checkedBan(error) {

        if (error) {
          formOps.outputError(error, 500, res);
        } else {

          // style exception, too simple
          postingOps.newThread(req, userData, parameters, captchaId,
              function threadCreated(error, id) {
                if (error) {
                  formOps.outputError(error, 500, res);
                } else {
                  var redirectLink = '../' + parameters.boardUri;
                  redirectLink += '/res/' + id + '.html';
                  formOps.outputResponse(lang.msgThreadCreated, redirectLink,
                      res);
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

    createThread(req, res, parameters, userData, cookies.captchaid);
  }, true);

};