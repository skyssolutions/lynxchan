'use strict';

var formOps = require('../engine/formOps');
var url = require('url');
var miscOps = require('../engine/miscOps');
var jsonBuilder = require('../engine/jsonBuilder');
var dom = require('../engine/domManipulator').dynamicPages.moderationPages;
var modOps = require('../engine/modOps').report;

function getClosedReports(userData, parameters, res, auth) {

  modOps.getClosedReports(userData, parameters, function gotClosedReports(
      error, reports) {
    if (error) {
      formOps.outputError(error, 500, res);
    } else {
      var json = parameters.json;

      res.writeHead(200, miscOps.corsHeader(json ? 'application/json'
          : 'text/html', auth));

      if (json) {
        res.end(jsonBuilder.closedReports(reports));
      } else {
        res.end(dom.closedReports(reports));
      }

    }
  });

}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, false,
      function gotData(auth, userData) {

        var parameters = url.parse(req.url, true).query;

        getClosedReports(userData, parameters, res, auth);

      });

};