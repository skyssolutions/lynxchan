'use strict';

var formOps = require('../engine/formOps');
var url = require('url');
var jsonBuilder = require('../engine/jsonBuilder');
var miscOps = require('../engine/miscOps');
var dom = require('../engine/domManipulator').dynamicPages.moderationPages;
var modOps = require('../engine/modOps').ipBan.general;

function getProxyBans(userData, parameters, res) {

  modOps.getProxyBans(userData, parameters, function gotProxyBans(error,
      proxyBans) {
    if (error) {
      formOps.outputError(error, 500, res);
    } else {
      var json = parameters.json;

      res.writeHead(200, miscOps.corsHeader(json ? 'application/json'
          : 'text/html'));

      if (json) {
        res.end(jsonBuilder.proxyBans(proxyBans));
      } else {
        res.end(dom.proxyBans(proxyBans, parameters.boardUri));
      }

    }
  });

}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, false,
      function gotData(auth, userData) {

        var parameters = url.parse(req.url, true).query;

        getProxyBans(userData, parameters, res);

      });

};