'use strict';

var boardOps = require('../engine/boardOps').meta;
var url = require('url');
var miscOps = require('../engine/miscOps');
var jsonB = require('../engine/jsonBuilder');
var dom = require('../engine/domManipulator').dynamicPages.managementPages;
var formOps = require('../engine/formOps');

exports.getBoardManagementData = function(board, userData, res, json, auth,
    language) {

  boardOps.getBoardManagementData(userData, board, !json, language,
      function gotManagementData(error, boardData, reports, bans) {
        if (error) {
          formOps.outputError(error, 500, res, language, json, auth);
        } else {

          if (json) {

            formOps.outputResponse('ok', jsonB.boardManagement(userData,
                boardData, reports, bans), res, null, auth, null, true);

          } else {
            res.writeHead(200, miscOps.getHeader('text/html', auth));
            res.end(dom.boardManagement(userData, boardData, reports, bans,
                language));
          }

        }
      });
};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, false,
      function gotData(auth, userData) {
        var parameters = url.parse(req.url, true).query;

        exports.getBoardManagementData(parameters.boardUri, userData, res,
            parameters.json, auth, req.language);
      }, false, false, true);
};