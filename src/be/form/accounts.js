'use strict';

var formOps = require('../engine/formOps');
var miscOps = require('../engine/miscOps');
var jsonBuilder = require('../engine/jsonBuilder');
var url = require('url');
var domManipulator = require('../engine/domManipulator').dynamicPages;
domManipulator = domManipulator.managementPages;
var accountOps = require('../engine/accountOps');

exports.getAccounts = function(auth, userData, res, req) {

  var json = url.parse(req.url, true).query.json;
  var language = req.language;

  accountOps.getAccounts(userData, language, function gotAccounts(error,
      accounts) {

    if (error) {
      formOps.outputError(error, 500, res, language, json, auth);
    } else {

      res.writeHead(200, miscOps.getHeader(json ? 'application/json'
          : 'text/html', auth));

      if (json) {
        res.end(jsonBuilder.accounts(accounts));
      } else {
        res.end(domManipulator.accounts(accounts, language));
      }

    }

  });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, false,
      function gotData(auth, userData) {
        exports.getAccounts(auth, userData, res, req);
      }, false, false, true);

};