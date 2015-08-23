'use strict';

var formOps = require('../engine/formOps');
var url = require('url');
var miscOps = require('../engine/miscOps');
var domManipulator = require('../engine/domManipulator').dynamicPages;
var modOps = require('../engine/modOps');

function getRangeBans(userData, parameters, res) {

  modOps.getRangeBans(userData, parameters, function gotRangeBans(error,
      rangeBans) {
    if (error) {
      formOps.outputError(error, res);
    } else {
      res.writeHead(200, miscOps.corsHeader('text/html'));

      res.end(domManipulator.rangeBans(rangeBans, parameters.boardUri));
    }
  });

}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, false,
      function gotData(auth, userData) {

        var parameters = url.parse(req.url, true).query;

        getRangeBans(userData, parameters, res);

      });

};