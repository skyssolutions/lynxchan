'use strict';

var formOps = require('../engine/formOps');
var url = require('url');
var jsonBuilder = require('../engine/jsonBuilder');
var miscOps = require('../engine/miscOps');
var boardOps = require('../engine/boardOps').banners;
var dom = require('../engine/domManipulator').dynamicPages.managementPages;

function getBannerData(parameters, userData, res) {

  boardOps
      .getBannerData(userData.login, parameters.boardUri,
          function gotBannerData(error, banners) {
            if (error) {
              formOps.outputError(error, 500, res);
            } else {
              var json = parameters.json;

              res.writeHead(200, miscOps.corsHeader(json ? 'application/json'
                  : 'text/html'));

              if (json) {
                res.end(jsonBuilder.bannerManagement(parameters.boardUri,
                    banners));
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

        getBannerData(parameters, userData, res);
      });
};