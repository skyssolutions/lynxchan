'use strict';

var formOps = require('../engine/formOps');
var url = require('url');
var miscOps = require('../engine/miscOps');
var boardOps = require('../engine/boardOps');
var dom = require('../engine/domManipulator').dynamicPages.managementPages;

function getRulesData(boardUri, userData, res) {

  boardOps.boardRules(boardUri, userData, function gotRules(error, rules) {
    if (error) {
      formOps.outputError(error, 500, res);
    } else {
      res.writeHead(200, miscOps.corsHeader('text/html'));

      res.end(dom.ruleManagement(boardUri, rules));
    }
  });

}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, false,
      function gotData(auth, userData) {

        var parameters = url.parse(req.url, true).query;

        getRulesData(parameters.boardUri, userData, res);

      });

};