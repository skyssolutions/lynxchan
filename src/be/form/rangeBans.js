'use strict';

var formOps = require('../engine/formOps');
var url = require('url');
var miscOps = require('../engine/miscOps');
var jsonBuilder = require('../engine/jsonBuilder');
var dom = require('../engine/domManipulator').dynamicPages.moderationPages;
var modOps = require('../engine/modOps').ipBan.general;

function getRangeBans(userData, parameters, res) {

  modOps.getRangeBans(userData, parameters, function gotRangeBans(error,
      rangeBans) {
    if (error) {
      formOps.outputError(error, 500, res);
    } else {
      var json = parameters.json;

      res.writeHead(200, miscOps.corsHeader(json ? 'application/json'
          : 'text/html'));

      if (json) {
        res.end(jsonBuilder.rangeBans(rangeBans));
      } else {
        res.end(dom.rangeBans(rangeBans, parameters.boardUri));
      }

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