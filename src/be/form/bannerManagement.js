'use strict';

var formOps = require('../engine/formOps');
var url = require('url');
var miscOps = require('../engine/miscOps');
var boardOps = require('../engine/boardOps');
var domManipulator = require('../engine/domManipulator');

function getBannerData(boardUri, userData, res) {

  boardOps.getBannerData(userData.login, boardUri, function gotBannerData(
      error, banners) {
    if (error) {
      formOps.outputError(error, 500, res);
    } else {
      res.writeHead(200, miscOps.corsHeader('text/html'));

      res.end(domManipulator.bannerManagement(boardUri, banners));
    }
  });
}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, false,
      function gotData(auth, userData) {
        var parameters = url.parse(req.url, true).query;

        getBannerData(parameters.boardUri, userData, res);
      });
};