'use strict';

var formOps = require('../engine/formOps');
var url = require('url');
var miscOps = require('../engine/miscOps');
var jsonBuilder = require('../engine/jsonBuilder');
var dom = require('../engine/domManipulator').dynamicPages.moderationPages;
var modOps = require('../engine/modOps').report;

exports.getClosedReports = function(userData, parameters, res, auth, language) {

  modOps.getClosedReports(userData, parameters, language,
      function gotClosedReports(error, reports) {
        if (error) {
          formOps.outputError(error, 500, res, language);
        } else {
          var json = parameters.json;

          res.writeHead(200, miscOps.getHeader(json ? 'application/json'
              : 'text/html', auth));

          if (json) {
            res.end(jsonBuilder.closedReports(reports));
          } else {
            res.end(dom.closedReports(reports, language));
          }

        }
      });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, false, function gotData(auth, user) {

    var parameters = url.parse(req.url, true).query;

    exports.getClosedReports(user, parameters, res, auth, req.language);

  });

};