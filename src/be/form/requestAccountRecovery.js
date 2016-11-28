'use strict';

var formOps = require('../engine/formOps');
var lang = require('../engine/langOps').languagePack;
var accountOps = require('../engine/accountOps');

function requestRecovery(domain, parameters, res, captchaId, language) {

  if (formOps.checkBlankParameters(parameters, [ 'login' ], res, language)) {
    return;
  }

  accountOps.requestRecovery(domain, language, parameters, captchaId,
      function requestCreated(error) {
        if (error) {
          formOps.outputError(error, 500, res, language);
        } else {
          formOps.outputResponse(lang(language).msgRequestCreated,
              '/login.html', res, null, null, language);
        }
      });

}

exports.process = function(req, res) {

  formOps.getPostData(req, res, function gotData(auth, parameters) {

    var cookies = formOps.getCookies(req);

    requestRecovery(formOps.getDomain(req), parameters, res, cookies.captchaid,
        req.language);

  });
};