'use strict';

var url = require('url');
var db = require('../db');
var accountOps = require('../engine/accountOps');
var formOps = require('../engine/formOps');

exports.process = function(req, res) {

  var parameters = url.parse(req.url, true).query;

  accountOps.recoverAccount(parameters, function recoveredAccount(error) {
    if (error) {
      formOps.outputError(error, 500, res);
    } else {
      formOps.outputResponse('The new password was sent to your e-mail',
          '/account.js', res);
    }

  });

};