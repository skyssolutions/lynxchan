'use strict';

var formOps = require('../engine/formOps');
var url = require('url');
var miscOps = require('../engine/miscOps');
var settingsHandler = require('../settingsHandler');
var dom = require('../engine/domManipulator').dynamicPages.moderationPages;
var modOps = require('../engine/modOps').ipBan.versatile;

exports.getBans = function(userData, parameters, res, auth, language) {

  var json = parameters.json;

  modOps.getBans(userData, parameters, language, function gotBans(error, bans) {
    if (error) {
      formOps.outputError(error, 500, res, language, json, auth);
    } else {

      if (json) {
        formOps.outputResponse('ok', bans.map(function(ban) {

          var allowed = userData.globalRole <= settingsHandler
              .getGeneralSettings().clearIpMinRole;

          if (!allowed) {
            delete ban.ip;
          }

          delete ban.bypassId;
          return ban;
        }), res, null, auth, null, true);
      } else {

        return formOps.dynamicPage(res, dom.bans(bans, !parameters.boardUri,
            userData.globalRole, language), auth);

      }

    }
  });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, false,
      function gotData(auth, userData) {
        var parameters = url.parse(req.url, true).query;

        exports.getBans(userData, parameters, res, auth, req.language);
      }, false, true);
};