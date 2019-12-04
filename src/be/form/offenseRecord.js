'use strict';

var url = require('url');
var formOps = require('../engine/formOps');
var domManipulator = require('../engine/domManipulator');
domManipulator = domManipulator.dynamicPages.managementPages;

exports.getMedia = function(auth, userData, parameters, res, language) {

  var json = parameters.json;

  res.end(JSON.stringify(parameters,null,2));

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, false,
      function gotData(auth, userData) {

        exports.getMedia(auth, userData, url.parse(req.url, true).query, res,
            req.language);

      }, false, true);

};