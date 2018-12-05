'use strict';

var url = require('url');
var accountOps = require('../engine/accountOps');
var lang = require('../engine/langOps').languagePack;
var formOps = require('../engine/formOps');

exports.process = function(req, res) {

  var parameters = url.parse(req.url, true).query;
  var json = parameters.json;

  accountOps.recoverAccount(parameters, req.language,
      function recoveredAccount(error) {
        if (error) {
          formOps.outputError(error, 500, res, req.language, json);
        } else {
          formOps.outputResponse(json ? 'ok'
              : lang(req.language).msgPasswordReset, json ? null
              : '/account.js', res, null, null, req.language, json);
        }

      });

};