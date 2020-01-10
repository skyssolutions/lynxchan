'use strict';

var formOps = require('../engine/formOps');
var url = require('url');
var miscOps = require('../engine/miscOps');
var dom = require('../engine/domManipulator').dynamicPages.moderationPages;
var modOps = require('../engine/modOps').ipBan.versatile;

exports.getAppealedBans = function(userData, parameters, res, auth, language) {

  var json = parameters.json;

  modOps.getAppealedBans(userData, parameters, language, function gotBans(
      error, bans) {
    if (error) {
      formOps.outputError(error, 500, res, language, json, auth);
    } else {

      if (json) {
        formOps.outputResponse('ok', bans, res, null, auth, null, true);
      } else {
        res.writeHead(200, miscOps.getHeader('text/html', auth));
        res.end(dom.bans(bans, !parameters.boardUri, language, true));
      }

    }
  });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, false,
      function gotData(auth, userData) {
        var parameters = url.parse(req.url, true).query;

        exports.getAppealedBans(userData, parameters, res, auth, req.language);
      }, false, true);
};