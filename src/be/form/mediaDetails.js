'use strict';

var url = require('url');
var formOps = require('../engine/formOps');
var mediaHandler = require('../engine/mediaHandler');
var miscOps = require('../engine/miscOps');
var jsonBuilder = require('../engine/jsonBuilder');
var domManipulator = require('../engine/domManipulator');
domManipulator = domManipulator.dynamicPages.managementPages;

exports.getMediaDetails = function(auth, userData, parameters, res, language) {

  var json = parameters.json;

  mediaHandler.getMediaDetails(userData, parameters, language,
      function gotMediaDetails(error, details) {

        if (error) {
          formOps.outputError(error, 500, res, language, json);
        } else {

          res.writeHead(200, miscOps.getHeader(json ? 'application/json'
              : 'text/html', auth));

          if (parameters.json) {
            res.end(jsonBuilder.mediaDetails(details));
          } else {
            res.end(domManipulator.mediaDetails(parameters.identifier, details,
                language));
          }

        }

      });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, false, function gotData(auth, user) {

    var parameters = url.parse(req.url, true).query;

    exports.getMediaDetails(auth, user, parameters, res, req.language);

  }, false, false, true);

};