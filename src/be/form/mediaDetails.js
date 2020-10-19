'use strict';

var url = require('url');
var formOps = require('../engine/formOps');
var mediaHandler = require('../engine/mediaHandler');
var miscOps = require('../engine/miscOps');
var domManipulator = require('../engine/domManipulator');
domManipulator = domManipulator.dynamicPages.managementPages;

exports.getMediaDetails = function(auth, userData, parameters, res, language) {

  var json = parameters.json;

  mediaHandler.getMediaDetails(userData, parameters, language,
      function gotMediaDetails(error, details) {

        if (error) {
          formOps.outputError(error, 500, res, language, json, auth);
        } else {

          if (json) {
            formOps.outputResponse('ok', details, res, null, auth, null, true);
          } else {
            formOps.dynamicPage(res, domManipulator.mediaDetails(
                parameters.identifier, details, language), auth);
          }

        }

      });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, false, function gotData(auth, user) {

    var parameters = url.parse(req.url, true).query;

    exports.getMediaDetails(auth, user, parameters, res, req.language);

  }, false, true);

};