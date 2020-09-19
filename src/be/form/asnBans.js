'use strict';

var formOps = require('../engine/formOps');
var url = require('url');
var miscOps = require('../engine/miscOps');
var jsonBuilder = require('../engine/jsonBuilder');
var dom = require('../engine/domManipulator').dynamicPages.moderationPages;
var modOps = require('../engine/modOps').ipBan.general;

exports.getAsnBans = function(userData, parameters, res, auth, language) {

  var json = parameters.json;

  modOps.getAsnBans(userData, parameters, language, function gotASNBans(error,
      asnBans, boardData) {
    if (error) {
      formOps.outputError(error, 500, res, language, json, auth);
    } else {

      if (json) {
        formOps.outputResponse('ok', asnBans, res, null, auth, null, json);
      } else {

        return formOps.dynamicPage(res, dom.asnBans(asnBans,
            !parameters.boardUri, boardData, language), auth);
      }

    }
  });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, false,
      function gotData(auth, userData) {

        var parameters = url.parse(req.url, true).query;

        exports.getAsnBans(userData, parameters, res, auth, req.language);

      }, false, true);

};