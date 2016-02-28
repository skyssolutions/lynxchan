'use strict';

var url = require('url');
var formOps = require('../engine/formOps');
var accountOps = require('../engine/accountOps');
var mediaHandler = require('../engine/mediaHandler');
var miscOps = require('../engine/miscOps');
var jsonBuilder = require('../engine/jsonBuilder');
var domManipulator = require('../engine/domManipulator');
domManipulator = domManipulator.dynamicPages.managementPages;

function getMedia(auth, userData, parameters, res) {

  mediaHandler.getMedia(userData, parameters, function gotMedia(error, media,
      pages) {

    if (error) {
      formOps.outputError(error, 500, res);
    } else {

      var json = parameters.json;

      res.writeHead(200, miscOps.corsHeader(json ? 'application/json'
          : 'text/html', auth));

      if (parameters.json) {
        res.end(jsonBuilder.mediaManagement(media, pages));
      } else {
        res.end(domManipulator.mediaManagement(media, pages, parameters));
      }

    }

  });

}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, false,
      function gotData(auth, userData) {

        var parameters = url.parse(req.url, true).query;

        getMedia(auth, userData, parameters, res);

      });

};