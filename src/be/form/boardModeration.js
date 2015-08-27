'use strict';

var boardOps = require('../engine/boardOps').meta;
var url = require('url');
var miscOps = require('../engine/miscOps');
var jsonBuilder = require('../engine/jsonBuilder');
var dom = require('../engine/domManipulator').dynamicPages.moderationPages;
var formOps = require('../engine/formOps');

function getBoardModerationData(parameters, userData, res) {

  boardOps.getBoardModerationData(userData, parameters.boardUri,
      function gotBoardModerationData(error, boardData, ownerData) {
        if (error) {
          formOps.outputError(error, 500, res);
        } else {
          var json = parameters.json;

          res.writeHead(200, miscOps.corsHeader(json ? 'application/json'
              : 'text/html'));

          if (json) {
            res.end(jsonBuilder.boardModeration(ownerData));
          } else {
            res.end(dom.boardModeration(boardData, ownerData));
          }

        }
      });
}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, false,
      function gotData(auth, userData) {
        var parameters = url.parse(req.url, true).query;

        getBoardModerationData(parameters, userData, res);
      });
};