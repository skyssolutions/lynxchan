'use strict';

var url = require('url');
var formOps = require('../engine/formOps');
var domManipulator = require('../engine/domManipulator');
domManipulator = domManipulator.dynamicPages.managementPages;
var mimeThumbOps = require('../engine/mimeThumbsOps');

exports.getThumbs = function(auth, userData, parameters, res, language) {

  var json = parameters.json;

  mimeThumbOps.getData(userData, language, function gotData(error, data) {

    if (error) {
      return formOps.outputError(error, 500, res, language, json, auth);
    }

    if (parameters.json) {
      formOps.outputResponse('ok', data, res, null, auth, null, true);
    } else {

      formOps.dynamicPage(res, domManipulator.thumbManagement(data, parameters,
          language), auth);
    }

  });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, false,
      function gotData(auth, userData) {

        var parameters = url.parse(req.url, true).query;

        exports.getThumbs(auth, userData, parameters, res, req.language);

      }, false, true);

};