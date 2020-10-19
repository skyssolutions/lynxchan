'use strict';

var formOps = require('../engine/formOps');
var miscOps = require('../engine/miscOps');
var jsonBuilder = require('../engine/jsonBuilder');
var url = require('url');
var domManipulator = require('../engine/domManipulator').dynamicPages;
domManipulator = domManipulator.managementPages;
var accountOps = require('../engine/accountOps');

exports.getAccount = function(auth, userData, res, req) {

  var parameters = url.parse(req.url, true).query;
  var json = parameters.json;
  var account = parameters.account;
  var language = req.language;

  accountOps.getAccountData(account, userData, language,
      function gotAccountData(error, accountData) {

        if (error) {
          formOps.outputError(error, 500, res, language, json, auth);
        } else {

          if (json) {
            formOps.outputResponse('ok', accountData, res, null, auth, null,
                true);
          } else {

            return formOps.dynamicPage(res, domManipulator.accountManagement(
                accountData, account, userData.globalRole, language), auth);

          }

        }

      });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, false,
      function gotData(auth, userData) {
        exports.getAccount(auth, userData, res, req);
      }, false, true);

};