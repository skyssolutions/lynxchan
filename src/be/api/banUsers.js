'use strict';

var apiOps = require('../engine/apiOps');
var miscOps = require('../engine/miscOps');
var modOps = require('../engine/modOps');

var banFields = [ {
  field : 'reason',
  length : 256
} ];

function reportContent(userData, parameters, res) {

  miscOps.sanitizeStrings(parameters, banFields);

  parameters.global = parameters.global ? true : false;

  modOps.ban(userData, parameters.postings || [], parameters,
      function createdReports(error) {
        if (error) {
          apiOps.outputError(error, res);
        } else {
          apiOps.outputResponse(null, null, 'ok', res);
        }

      });
}

exports.process = function(req, res) {

  apiOps.getAuthenticatedData(req, res, function gotData(auth, userData,
      parameters) {

    reportContent(userData, parameters, res);

  });

};