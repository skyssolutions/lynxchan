'use strict';

var formOps = require('../engine/formOps');
var url = require('url');
var miscOps = require('../engine/miscOps');
var boardOps = require('../engine/boardOps');
var domManipulator = require('../engine/domManipulator').dynamicPages;

function getFlagData(boardUri, userData, res) {

  boardOps.getFlagsData(userData.login, boardUri, function gotFlagData(error,
      flags) {
    if (error) {
      formOps.outputError(error, 500, res);
    } else {
      res.writeHead(200, miscOps.corsHeader('text/html'));

      res.end(domManipulator.flagManagement(boardUri, flags));
    }
  });

}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, false,
      function gotData(auth, userData) {

        var parameters = url.parse(req.url, true).query;

        getFlagData(parameters.boardUri, userData, res);

      });

};