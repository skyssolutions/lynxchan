'use strict';

var url = require('url');
var miscOps = require('../engine/miscOps');
var formOps = require('../engine/formOps');
var domManipulator = require('../engine/domManipulator');
var offenseOps = require('../engine/offenseOps');
domManipulator = domManipulator.dynamicPages.managementPages;

exports.getOffenses = function(auth, userData, parameters, res, language) {

  var json = parameters.json;

  offenseOps.getOffenses(userData, parameters, language, function(error,
      offenses) {

    if (error) {
      formOps.outputError(error, 500, res, language, json, auth);
    } else {

      if (json) {
        formOps.outputResponse('ok', offenses, res, null, auth, null, true);
      } else {

        res.writeHead(200, miscOps.getHeader('text/html', auth));
        res.end(domManipulator.offenseRecord(offenses, parameters, language));

      }

    }

  });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, false,
      function gotData(auth, userData) {

        exports.getOffenses(auth, userData, url.parse(req.url, true).query,
            res, req.language);

      }, false, true);

};