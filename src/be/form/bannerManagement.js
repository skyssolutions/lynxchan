'use strict';

var formOps = require('../engine/formOps');
var url = require('url');
var jsonBuilder = require('../engine/jsonBuilder');
var miscOps = require('../engine/miscOps');
var bOps = require('../engine/bannerOps');
var dom = require('../engine/domManipulator').dynamicPages.managementPages;

exports.getBannerData = function(auth, parameters, userData, res, language) {

  bOps
      .getBannerData(userData, parameters.boardUri, language,
          function gotBannerData(error, banners) {
            if (error) {
              formOps.outputError(error, 500, res, language);
            } else {
              var json = parameters.json;

              res.writeHead(200, miscOps.getHeader(json ? 'application/json'
                  : 'text/html', auth));

              if (json) {
                res.end(jsonBuilder.bannerManagement(parameters.boardUri,
                    banners));
              } else {
                res.end(dom.bannerManagement(parameters.boardUri, banners,
                    language));
              }

            }
          });
};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, false,
      function gotData(auth, userData) {
        var parameters = url.parse(req.url, true).query;

        exports.getBannerData(auth, parameters, userData, res, req.language);
      });
};