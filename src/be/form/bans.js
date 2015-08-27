'use strict';

var formOps = require('../engine/formOps');
var url = require('url');
var miscOps = require('../engine/miscOps');
var jsonBuilder = require('../engine/jsonBuilder');
var dom = require('../engine/domManipulator').dynamicPages.moderationPages;
var modOps = require('../engine/modOps').ipBan;

function getBans(userData, parameters, res) {

  modOps.getBans(userData, parameters, function gotBans(error, bans) {
    if (error) {
      formOps.outputError(error, res);
    } else {

      var json = parameters.json;

      res.writeHead(200, miscOps.corsHeader(json ? 'application/json'
          : 'text/html'));

      if (json) {
        res.end(jsonBuilder.bans(bans));
      } else {
        res.end(dom.bans(bans));
      }

    }
  });
}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, false,
      function gotData(auth, userData) {
        var parameters = url.parse(req.url, true).query;

        getBans(userData, parameters, res);
      });
};