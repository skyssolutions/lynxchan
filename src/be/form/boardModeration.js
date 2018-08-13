'use strict';

var boardOps = require('../engine/boardOps').meta;
var url = require('url');
var miscOps = require('../engine/miscOps');
var jsonBuilder = require('../engine/jsonBuilder');
var dom = require('../engine/domManipulator').dynamicPages.moderationPages;
var formOps = require('../engine/formOps');

exports.getBoardModerationData = function(parameters, userData, res, auth,
    language) {

  var json = parameters.json;

  boardOps.getBoardModerationData(userData, parameters.boardUri, language,
      function gotBoardModerationData(error, boardData, ownerData) {
        if (error) {
          formOps.outputError(error, 500, res, language, json);
        } else {

          res.writeHead(200, miscOps.getHeader(json ? 'application/json'
              : 'text/html', auth));

          if (json) {
            res.end(jsonBuilder.boardModeration(boardData, ownerData));
          } else {
            res.end(dom.boardModeration(boardData, ownerData, language));
          }

        }
      });
};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, false,
      function gotData(auth, userData) {
        var parameters = url.parse(req.url, true).query;

        exports.getBoardModerationData(parameters, userData, res, auth,
            req.language);
      });
};