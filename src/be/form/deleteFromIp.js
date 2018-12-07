'use strict';

var formOps = require('../engine/formOps');
var lang = require('../engine/langOps').languagePack;
var delOps = require('../engine/deletionOps');

exports.deleteFromIp = function(userData, param, res, auth, language, json) {

  if (formOps.checkBlankParameters(param, [ 'ip' ], res, language, json)) {
    return;
  }

  delOps.deleteFromIp(param, userData, language, function deletedFromIp(error) {

    if (error) {
      formOps.outputError(error, 500, res, language, json, auth);
    } else {
      formOps
          .outputResponse(json ? 'ok' : lang(language).msgDeletedFromIp,
              json ? null : '/globalManagement.js', res, null, auth, language,
              json);
    }

  });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {
    exports.deleteFromIp(userData, parameters, res, auth, req.language, formOps
        .json(req));
  });

};