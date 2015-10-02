'use strict';

var formOps = require('../engine/formOps');
var accountOps = require('../engine/accountOps');
var lang = require('../engine/langOps').languagePack();
var url = require('url');

exports.process = function(req, res) {

  var parameters = url.parse(req.url, true).query;

  accountOps.unlockAccount(parameters, function unlockedAccount(error) {

    if (error) {
      formOps.outputError(error, 500, res);
    } else {
      formOps.outputResponse(lang.msgAccountUnlocked, '/login.html', res);
    }

  });

};