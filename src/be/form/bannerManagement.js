'use strict';

var formOps = require('../engine/formOps');
var url = require('url');
var jsonBuilder = require('../engine/jsonBuilder');
var miscOps = require('../engine/miscOps');
var bOps = require('../engine/bannerOps');
var dom = require('../engine/domManipulator').dynamicPages.managementPages;

function getBannerData(auth, parameters, userData, res) {

  bOps.getBannerData(userData, parameters.boardUri, function gotBannerData(
      error, banners) {
    if (error) {
      formOps.outputError(error, 500, res);
    } else {
      var json = parameters.json;

      res.writeHead(200, miscOps.corsHeader(json ? 'application/json'
          : 'text/html', auth));

      if (json) {
        res.end(jsonBuilder.bannerManagement(parameters.boardUri, banners));
      } else {
        res.end(dom.bannerManagement(parameters.boardUri, banners));
      }

    }
  });
}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, false,
      function gotData(auth, userData) {
        var parameters = url.parse(req.url, true).query;

        getBannerData(auth, parameters, userData, res);
      });
};