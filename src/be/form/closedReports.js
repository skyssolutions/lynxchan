'use strict';

var formOps = require('../engine/formOps');
var url = require('url');
var miscOps = require('../engine/miscOps');
var jsonBuilder = require('../engine/jsonBuilder');
var dom = require('../engine/domManipulator').dynamicPages.moderationPages;
var modOps = require('../engine/modOps').report;

exports.getClosedReports = function(userData, parameters, res, auth, language) {

  var json = parameters.json;

  modOps.getClosedReports(userData, parameters, language,
      function gotClosedReports(error, reports) {
        if (error) {
          formOps.outputError(error, 500, res, language, json, auth);
        } else {

          if (json) {
            formOps.outputResponse('ok', reports, res, null, auth, null, true);
          } else {
            res.writeHead(200, miscOps.getHeader('text/html', auth));
            res.end(dom.closedReports(reports, language));
          }

        }
      });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, false, function gotData(auth, user) {

    var parameters = url.parse(req.url, true).query;

    exports.getClosedReports(user, parameters, res, auth, req.language);

  }, false, false, true);

};