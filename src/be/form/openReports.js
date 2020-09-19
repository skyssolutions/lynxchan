'use strict';

var formOps = require('../engine/formOps');
var url = require('url');
var miscOps = require('../engine/miscOps');
var jsonBuilder = require('../engine/jsonBuilder');
var dom = require('../engine/domManipulator').dynamicPages.moderationPages;
var modOps = require('../engine/modOps').report;

exports.getOpenReports = function(userData, parameters, res, auth, language) {

  var json = parameters.json;

  modOps.getOpenReports(userData, parameters, language,
      function gotOpenReports(error, reports, boardData) {
        if (error) {
          formOps.outputError(error, 500, res, language, json, auth);
        } else {

          if (json) {
            formOps.outputResponse('ok', reports, res, null, auth, null, true);
          } else {

            formOps.dynamicPage(res, dom.openReports(reports, boardData,
                userData, language), auth);

          }

        }
      });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, false, function gotData(auth, user) {

    var parameters = url.parse(req.url, true).query;

    exports.getOpenReports(user, parameters, res, auth, req.language);

  }, false, true);

};