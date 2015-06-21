'use strict';

var apiOps = require('../engine/apiOps');
var modOps = require('../engine/modOps');

function reportContent(req, parameters, res) {

  parameters.global = parameters.global ? true : false;

  modOps.report(req, parameters.postings || [], parameters,
      function createdReports(error) {
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