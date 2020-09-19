'use strict';

var boardOps = require('../engine/boardOps').meta;
var url = require('url');
var miscOps = require('../engine/miscOps');
var jsonB = require('../engine/jsonBuilder');
var dom = require('../engine/domManipulator').dynamicPages.broadManagement;
var formOps = require('../engine/formOps');

exports.getBoardManagementData = function(board, userData, res, json, auth,
    language) {

  boardOps.getBoardManagementData(userData, board, !json, language,
      function gotManagementData(error, bData, languages, bans, reportCount) {

        if (error) {
          return formOps.outputError(error, 500, res, language, json, auth);
        }

        if (json) {

          formOps.outputResponse('ok', jsonB.boardManagement(userData, bData,
              languages, bans, reportCount), res, null, auth, null, true);

        } else {

          return formOps.dynamicPage(res, dom.boardManagement(userData, bData,
              languages, bans, reportCount, language), auth);

        }

      });
};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, false,
      function gotData(auth, userData) {
        var parameters = url.parse(req.url, true).query;

        exports.getBoardManagementData(parameters.boardUri, userData, res,
            parameters.json, auth, req.language);
      }, false, true);
};