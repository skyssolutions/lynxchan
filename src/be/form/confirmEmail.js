'use strict';

var url = require('url');
var accountOps = require('../engine/accountOps');
var lang = require('../engine/langOps').languagePack;
var formOps = require('../engine/formOps');

exports.process = function(req, res) {

  var parameters = url.parse(req.url, true).query;

  accountOps.confirmEmail(parameters, req.language, function emailConfirmed(
      error) {
    if (error) {
      formOps.outputError(error, 500, res, req.language);
    } else {
      formOps.outputResponse(lang(req.language).msgEmailConfirmed,
          '/account.js', res, null, null, req.language);
    }

  });

};