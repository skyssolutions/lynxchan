'use strict';

var formOps = require('../engine/formOps');
var url = require('url');
var jsonBuilder = require('../engine/jsonBuilder');
var miscOps = require('../engine/miscOps');
var boardOps = require('../engine/boardOps').rules;
var dom = require('../engine/domManipulator').dynamicPages.managementPages;

exports.getRulesData = function(parameters, userData, res, auth, language) {

  boardOps.boardRules(parameters.boardUri, userData, language,
      function gotRules(error, rules) {
        if (error) {
          formOps.outputError(error, 500, res, language);
        } else {
          var json = parameters.json;

          res.writeHead(200, miscOps.getHeader(json ? 'application/json'
              : 'text/html', auth));

          if (json) {
            res.end(jsonBuilder.ruleManagement(rules));
          } else {
            res.end(dom.ruleManagement(parameters.boardUri, rules, language));
          }
        }
      });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, false,
      function gotData(auth, userData) {

        var parameters = url.parse(req.url, true).query;

        exports.getRulesData(parameters, userData, res, auth, req.language);

      });

};