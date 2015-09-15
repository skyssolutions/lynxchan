'use strict';

var formOps = require('../engine/formOps');
var postingOps = require('../engine/postingOps').post;
var captchaOps = require('../engine/captchaOps');
var lang = require('../engine/langOps').languagePack();
var mandatoryParameters = [ 'message', 'boardUri', 'threadId' ];

function createPost(req, userData, parameters, captchaId, res) {

  postingOps.newPost(req, userData, parameters, captchaId,
      function postCreated(error, id) {
        if (error) {
          formOps.outputError(error, 500, res);
        } else {
          var redirectLink = '../' + parameters.boardUri;
          redirectLink += '/res/' + parameters.threadId;
          redirectLink += '.html#' + id;
          formOps.outputResponse(lang.msgPostCreated, redirectLink, res);
        }
      });

}

function checkBans(req, res, parameters, userData, captchaId) {

  if (formOps.checkBlankParameters(parameters, mandatoryParameters, res)) {
    return;
  }

  formOps.checkForBan(req, parameters.boardUri, res,
      function checkedBan(error) {

        if (error) {
          formOps.outputError(error, 500, res);
        } else {

          // style exception, too simple
          formOps.checkForHashBan(parameters, req, res,
              function checkedHashBans(error) {
                if (error) {
                  formOps.outputError(error, 500, res);
                } else {
                  createPost(req, userData, parameters, captchaId, res);
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
    checkBans(req, res, parameters, userData, cookies.captchaid);
  }, true);

};