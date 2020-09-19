'use strict';

var formOps = require('../engine/formOps');
var url = require('url');
var miscOps = require('../engine/miscOps');
var jsonBuilder = require('../engine/jsonBuilder');
var dom = require('../engine/domManipulator').dynamicPages.moderationPages;
var modOps = require('../engine/modOps').ipBan.general;

exports.getRangeBans = function(userData, parameters, res, auth, language) {

  var json = parameters.json;

  modOps.getRangeBans(userData, parameters, language, function gotRangeBans(
      error, rangeBans, boardData) {
    if (error) {
      formOps.outputError(error, 500, res, language, json, auth);
    } else {

      if (json) {
        formOps.outputResponse('ok', jsonBuilder.rangeBans(rangeBans,
            boardData, userData.globalRole), res, null, auth, null, json);
      } else {

        formOps.dynamicPage(res, dom.rangeBans(rangeBans, !parameters.boardUri,
            boardData, userData.globalRole, language), auth);

      }

    }
  });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, false,
      function gotData(auth, userData) {

        var parameters = url.parse(req.url, true).query;

        exports.getRangeBans(userData, parameters, res, auth, req.language);

      }, false, true);

};