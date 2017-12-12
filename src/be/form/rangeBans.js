'use strict';

var formOps = require('../engine/formOps');
var url = require('url');
var miscOps = require('../engine/miscOps');
var jsonBuilder = require('../engine/jsonBuilder');
var dom = require('../engine/domManipulator').dynamicPages.moderationPages;
var modOps = require('../engine/modOps').ipBan.general;

exports.getRangeBans = function(userData, parameters, res, auth, language) {

  modOps.getRangeBans(userData, parameters, language, function gotRangeBans(
      error, rangeBans, boardData) {
    if (error) {
      formOps.outputError(error, 500, res, language);
    } else {
      var json = parameters.json;

      res.writeHead(200, miscOps.getHeader(json ? 'application/json'
          : 'text/html', auth));

      if (json) {
        res.end(jsonBuilder.rangeBans(rangeBans, boardData));
      } else {
        res.end(dom.rangeBans(rangeBans, boardData, language));
      }

    }
  });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, false,
      function gotData(auth, userData) {

        var parameters = url.parse(req.url, true).query;

        exports.getRangeBans(userData, parameters, res, auth, req.language);

      });

};