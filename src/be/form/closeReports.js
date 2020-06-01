'use strict';

var formOps = require('../engine/formOps');
var lang = require('../engine/langOps').languagePack;
var modOps = require('../engine/modOps').report;

exports.closeReport = function(userData, param, res, auth, language, json) {

  var reports = [];

  for ( var key in param) {

    if (!param.hasOwnProperty(key)) {
      continue;
    }

    if (!key.indexOf('report-')) {
      reports.push(key.substring(7));
    }

  }

  param.reports = reports;

  modOps.closeReports(userData, param, language, function reportClosed(error,
      global, board) {
    if (error) {
      formOps.outputError(error, 500, res, language, json, auth);
    } else {

      var redirect = global ? '/globalManagement.js'
          : '/boardManagement.js?boardUri=' + board;

      formOps.outputResponse(json ? 'ok' : lang(language).msgReportsClosed,
          json ? null : redirect, res, null, auth, language, json);
    }

  });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {
    exports.closeReport(userData, parameters, res, auth, req.language, formOps
        .json(req));
  });

};