'use strict';

var formOps = require('../engine/formOps');
var url = require('url');
var jsonBuilder = require('../engine/jsonBuilder');
var miscOps = require('../engine/miscOps');
var dom = require('../engine/domManipulator').dynamicPages.moderationPages;
var modOps = require('../engine/modOps').hashBan;

exports.getHashBans = function(userData, parameters, res, auth, language) {

  var json = parameters.json;

  modOps.getHashBans(userData, parameters, language, function gotHashBans(
      error, hashBans) {
    if (error) {
      formOps.outputError(error, 500, res, language, json);
    } else {

      res.writeHead(200, miscOps.getHeader(json ? 'application/json'
          : 'text/html', auth));

      if (json) {
        res.end(jsonBuilder.hashBans(hashBans));
      } else {
        res.end(dom.hashBans(hashBans, parameters.boardUri, language));
      }

    }
  });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, false,
      function gotData(auth, userData) {

        var parameters = url.parse(req.url, true).query;

        exports.getHashBans(userData, parameters, res, auth, req.language);

      }, false, false, true);

};