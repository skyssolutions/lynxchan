'use strict';

var formOps = require('../engine/formOps');
var url = require('url');
var miscOps = require('../engine/miscOps');
var boardOps = require('../engine/boardOps');
var domManipulator = require('../engine/domManipulator').dynamicPages;

function getFilterData(boardUri, userData, res) {

  boardOps.getFilterData(userData.login, boardUri, function gotFilterData(
      error, filters) {
    if (error) {
      formOps.outputError(error, 500, res);
    } else {
      res.writeHead(200, miscOps.corsHeader('text/html'));

      res.end(domManipulator.filterManagement(boardUri, filters));
    }
  });

}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, false,
      function gotData(auth, userData) {

        var parameters = url.parse(req.url, true).query;

        getFilterData(parameters.boardUri, userData, res);

      });

};