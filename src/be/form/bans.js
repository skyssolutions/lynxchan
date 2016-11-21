'use strict';

var formOps = require('../engine/formOps');
var url = require('url');
var miscOps = require('../engine/miscOps');
var jsonBuilder = require('../engine/jsonBuilder');
var dom = require('../engine/domManipulator').dynamicPages.moderationPages;
var modOps = require('../engine/modOps').ipBan.versatile;

function getBans(userData, parameters, res, auth, language) {

  modOps.getBans(userData, parameters, function gotBans(error, bans) {
    if (error) {
      formOps.outputError(error, 500, res, language);
    } else {

      var json = parameters.json;

      res.writeHead(200, miscOps.corsHeader(json ? 'application/json'
          : 'text/html', auth));

      if (json) {
        res.end(jsonBuilder.bans(bans));
      } else {
        res.end(dom.bans(bans, language));
      }

    }
  });
}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, false,
      function gotData(auth, userData) {
        var parameters = url.parse(req.url, true).query;

        getBans(userData, parameters, res, auth, req.language);
      });
};