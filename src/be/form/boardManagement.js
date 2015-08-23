'use strict';

var boardOps = require('../engine/boardOps');
var url = require('url');
var miscOps = require('../engine/miscOps');
var dom = require('../engine/domManipulator').dynamicPages.managementPages;
var formOps = require('../engine/formOps');

function getBoardManagementData(board, userData, res) {

  boardOps.getBoardManagementData(userData.login, board,
      function gotManagementData(error, boardData, reports) {
        if (error) {
          formOps.outputError(error, 500, res);
        } else {
          res.writeHead(200, miscOps.corsHeader('text/html'));

          res.end(dom.boardManagement(userData.login, boardData, reports));
        }
      });
}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, false,
      function gotData(auth, userData) {
        var parameters = url.parse(req.url, true).query;

        getBoardManagementData(parameters.boardUri, userData, res);
      });
};