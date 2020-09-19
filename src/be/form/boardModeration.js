'use strict';

var boardOps = require('../engine/boardOps').meta;
var url = require('url');
var miscOps = require('../engine/miscOps');
var dom = require('../engine/domManipulator').dynamicPages.moderationPages;
var formOps = require('../engine/formOps');

exports.getBoardModerationData = function(parameters, userData, res, auth,
    language) {

  var json = parameters.json;

  boardOps.getBoardModerationData(userData, parameters.boardUri, language,
      function gotBoardModerationData(error, boardData, ownerData) {
        if (error) {
          formOps.outputError(error, 500, res, language, json, auth);
        } else {

          if (json) {

            formOps.outputResponse('ok', {
              owner : ownerData.login,
              specialSettings : boardData.specialSettings || [],
              lastSeen : ownerData.lastSeen
            }, res, null, auth, null, true);

          } else {

            return formOps.dynamicPage(res, dom.boardModeration(boardData,
                ownerData, language), auth);

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
      }, false, true);
};