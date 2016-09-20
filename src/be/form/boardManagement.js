'use strict';

var boardOps = require('../engine/boardOps').meta;
var url = require('url');
var miscOps = require('../engine/miscOps');
var jsonB = require('../engine/jsonBuilder');
var dom = require('../engine/domManipulator').dynamicPages.managementPages;
var formOps = require('../engine/formOps');

function getBoardManagementData(board, userData, res, json, auth) {

  boardOps.getBoardManagementData(userData, board, !json,
      function gotManagementData(error, boardData, reports, bans) {
        if (error) {
          formOps.outputError(error, 500, res);
        } else {
          res.writeHead(200, miscOps.corsHeader(json ? 'application/json'
              : 'text/html', auth));

          if (json) {
            res.end(jsonB.boardManagement(userData, boardData, reports, bans));
          } else {
            res.end(dom.boardManagement(userData, boardData, reports, bans));
          }

        }
      });
}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, false,
      function gotData(auth, userData) {
        var parameters = url.parse(req.url, true).query;

        getBoardManagementData(parameters.boardUri, userData, res,
            parameters.json, auth);
      });
};