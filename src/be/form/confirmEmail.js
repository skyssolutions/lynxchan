'use strict';

var url = require('url');
var accountOps = require('../engine/accountOps');
var lang = require('../engine/langOps').languagePack;
var formOps = require('../engine/formOps');

exports.process = function(req, res) {

  var parameters = url.parse(req.url, true).query;

  var json = parameters.json;

  accountOps.confirmEmail(parameters, req.language, function emailConfirmed(
      error) {
    if (error) {
      formOps.outputError(error, 500, res, req.language, json);
    } else {
      formOps.outputResponse(
          json ? 'ok' : lang(req.language).msgEmailConfirmed, json ? null
              : '/account.js', res, null, null, req.language, json);
    }

  });

};