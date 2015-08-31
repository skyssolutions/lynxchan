'use strict';

var formOps = require('../engine/formOps');
var lang = require('../engine/langOps').languagePack();
var accountOps = require('../engine/accountOps');

function requestRecovery(domain, parameters, res, captchaId) {

  if (formOps.checkBlankParameters(parameters, [ 'login' ], res)) {
    return;
  }

  accountOps.requestRecovery(domain, parameters, captchaId,
      function requestCreated(error) {
        if (error) {
          formOps.outputError(error, 500, res);
        } else {
          formOps.outputResponse(lang.msgRequestCreated, '/login.html', res);
        }
      });

}

exports.process = function(req, res) {

  formOps.getPostData(req, res, function gotData(auth, parameters) {

    var cookies = formOps.getCookies(req);

    requestRecovery('http://' + req.headers.host, parameters, res,
        cookies.captchaid);

  });
};