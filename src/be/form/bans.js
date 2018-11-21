'use strict';

var formOps = require('../engine/formOps');
var url = require('url');
var miscOps = require('../engine/miscOps');
var jsonBuilder = require('../engine/jsonBuilder');
var dom = require('../engine/domManipulator').dynamicPages.moderationPages;
var modOps = require('../engine/modOps').ipBan.versatile;

exports.getBans = function(userData, parameters, res, auth, language) {

  var json = parameters.json;

  modOps.getBans(userData, parameters, language, function gotBans(error, bans) {
    if (error) {
      formOps.outputError(error, 500, res, language, json, auth);
    } else {

      res.writeHead(200, miscOps.getHeader(json ? 'application/json'
          : 'text/html', auth));

      if (json) {
        res.end(jsonBuilder.bans(bans));
      } else {
        res.end(dom.bans(bans, !parameters.boardUri, language));
      }

    }
  });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, false,
      function gotData(auth, userData) {
        var parameters = url.parse(req.url, true).query;

        exports.getBans(userData, parameters, res, auth, req.language);
      }, false, false, true);
};