'use strict';

var boardOps = require('../engine/boardOps').meta;
var url = require('url');
var miscOps = require('../engine/miscOps');
var dom = require('../engine/domManipulator').dynamicPages.moderationPages;
var formOps = require('../engine/formOps');

function getBoardModerationData(board, userData, res) {

  boardOps.getBoardModerationData(userData, board,
      function gotBoardModerationData(error, boardData, ownerData) {
        if (error) {
          formOps.outputError(error, 500, res);
        } else {
          res.writeHead(200, miscOps.corsHeader('text/html'));

          res.end(dom.boardModeration(boardData, ownerData));
        }
      });
}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, false,
      function gotData(auth, userData) {
        var parameters = url.parse(req.url, true).query;

        getBoardModerationData(parameters.boardUri, userData, res);
      });
};