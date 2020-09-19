'use strict';

var formOps = require('../engine/formOps');
var url = require('url');
var miscOps = require('../engine/miscOps');
var bOps = require('../engine/bannerOps');
var dom = require('../engine/domManipulator').dynamicPages.managementPages;

exports.getBannerData = function(auth, parameters, userData, res, language) {

  var json = parameters.json;
  var uri = parameters.boardUri;

  bOps.getBannerData(userData, uri, language, function gotBannerData(error,
      banners) {
    if (error) {
      formOps.outputError(error, 500, res, language, json, auth);
    } else {

      if (json) {
        formOps.outputResponse('ok', banners, res, null, auth, null, true);
      } else {

        return formOps.dynamicPage(res, dom.bannerManagement(uri, banners,
            language), auth);
      }

    }
  });
};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, false,
      function gotData(auth, userData) {
        var parameters = url.parse(req.url, true).query;

        exports.getBannerData(auth, parameters, userData, res, req.language);
      }, false, true);
};