'use strict';

var url = require('url');
var formOps = require('../engine/formOps');
var mediaHandler = require('../engine/mediaHandler');
var miscOps = require('../engine/miscOps');
var jsonBuilder = require('../engine/jsonBuilder');
var domManipulator = require('../engine/domManipulator');
domManipulator = domManipulator.dynamicPages.managementPages;

exports.getMedia = function(auth, userData, parameters, res, language) {

  var json = parameters.json;

  mediaHandler.getMedia(userData, parameters, language, function gotMedia(
      error, media, pages) {

    if (error) {
      formOps.outputError(error, 500, res, language, json);
    } else {

      res.writeHead(200, miscOps.getHeader(json ? 'application/json'
          : 'text/html', auth));

      if (parameters.json) {
        res.end(jsonBuilder.mediaManagement(media, pages));
      } else {
        res.end(domManipulator.mediaManagement(media, pages, parameters,
            language));
      }

    }

  });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, false,
      function gotData(auth, userData) {

        var parameters = url.parse(req.url, true).query;

        exports.getMedia(auth, userData, parameters, res, req.language);

      });

};