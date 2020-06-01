'use strict';

var formOps = require('../engine/formOps');
var lang = require('../engine/langOps').languagePack;
var accountOps = require('../engine/accountOps');

exports.requestRecovery = function(domain, params, res, captchaId, language,
    json) {

  if (formOps.checkBlankParameters(params, [ 'login' ], res, language, json)) {
    return;
  }

  accountOps.requestRecovery(domain, language, params, captchaId,
      function requestCreated(error) {
        if (error) {
          formOps.outputError(error, 500, res, language, json);
        } else {
          formOps.outputResponse(
              json ? 'ok' : lang(language).msgRequestCreated, json ? null
                  : '/login.html', res, null, null, language, json);
        }
      });

};

exports.process = function(req, res) {

  formOps.getPostData(req, res, function gotData(auth, parameters) {

    var cookies = formOps.getCookies(req);

    exports.requestRecovery(formOps.getDomain(req), parameters, res,
        cookies.captchaid, req.language, formOps.json(req));

  });
};