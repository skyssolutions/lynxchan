'use strict';

var formOps = require('../engine/formOps');
var url = require('url');
var miscOps = require('../engine/miscOps');
var dom = require('../engine/domManipulator').dynamicPages.moderationPages;
var modOps = require('../engine/modOps').report;

function getClosedReports(userData, parameters, res) {

  modOps.getClosedReports(userData, parameters, function gotClosedReports(
      error, reports) {
    if (error) {
      formOps.outputError(error, res);
    } else {
      res.writeHead(200, miscOps.corsHeader('text/html'));

      res.end(dom.closedReports(reports));
    }
  });

}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, false,
      function gotData(auth, userData) {

        var parameters = url.parse(req.url, true).query;

        getClosedReports(userData, parameters, res);

      });

};