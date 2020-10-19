'use strict';

var formOps = require('../engine/formOps');
var url = require('url');
var miscOps = require('../engine/miscOps');
var boardOps = require('../engine/boardOps').rules;
var dom = require('../engine/domManipulator').dynamicPages.managementPages;

exports.getRulesData = function(parameters, userData, res, auth, language) {

  var json = parameters.json;

  boardOps.boardRules(parameters.boardUri, userData, language,
      function gotRules(error, rules) {
        if (error) {
          formOps.outputError(error, 500, res, language, json, auth);
        } else {

          if (json) {
            formOps.outputResponse('ok', rules, res, null, auth, null, true);
          } else {

            formOps.dynamicPage(res, dom.ruleManagement(parameters.boardUri,
                rules, language), auth);

          }
        }
      });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, false,
      function gotData(auth, userData) {

        var parameters = url.parse(req.url, true).query;

        exports.getRulesData(parameters, userData, res, auth, req.language);

      }, false, true);

};