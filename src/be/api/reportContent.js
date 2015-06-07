'use strict';

var apiOps = require('../engine/apiOps');
var miscOps = require('../engine/miscOps');
var modOps = require('../engine/modOps');

var reportFields = [ {
  field : 'reason',
  length : 256
} ];

function reportContent(req, parameters, res) {

  miscOps.sanitizeStrings(parameters, reportFields);

  parameters.global = parameters.global ? true : false;

  modOps.report(req, parameters.postings, parameters, function createdReports(
      error) {
    if (error) {
      apiOps.outputError(error, res);
    } else {
      apiOps.outputResponse(null, null, 'ok', res);
    }

  });
}

exports.process = function(req, res) {

  apiOps.getAnonJsonData(req, res, function gotData(auth, parameters) {

    reportContent(req, parameters, res);

  });

};