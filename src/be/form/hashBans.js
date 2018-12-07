'use strict';

var formOps = require('../engine/formOps');
var url = require('url');
var miscOps = require('../engine/miscOps');
var dom = require('../engine/domManipulator').dynamicPages.moderationPages;
var modOps = require('../engine/modOps').hashBan;

exports.getHashBans = function(userData, parameters, res, auth, language) {

  var json = parameters.json;

  modOps.getHashBans(userData, parameters, language, function gotHashBans(
      error, hashBans) {
    if (error) {
      formOps.outputError(error, 500, res, language, json, auth);
    } else {

      if (json) {
        formOps.outputResponse('ok', hashBans, res, null, auth, null, true);
      } else {
        res.writeHead(200, miscOps.getHeader('text/html', auth));
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