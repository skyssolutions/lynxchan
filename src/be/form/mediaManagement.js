'use strict';

var url = require('url');
var formOps = require('../engine/formOps');
var mediaHandler = require('../engine/mediaHandler');
var miscOps = require('../engine/miscOps');
var domManipulator = require('../engine/domManipulator');
domManipulator = domManipulator.dynamicPages.managementPages;

exports.getMedia = function(auth, userData, parameters, res, language) {

  var json = parameters.json;

  mediaHandler.getMedia(userData, parameters, language, function gotMedia(
      error, media, pages) {

    if (error) {
      formOps.outputError(error, 500, res, language, json, auth);
    } else {

      if (parameters.json) {
        formOps.outputResponse('ok', {
          pages : pages,
          media : media
        }, res, null, auth, null, true);
      } else {

        formOps.dynamicPage(res, domManipulator.mediaManagement(
            userData.globalRole, media, pages, parameters, language), auth);
      }

    }

  });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, false,
      function gotData(auth, userData) {

        var parameters = url.parse(req.url, true).query;

        exports.getMedia(auth, userData, parameters, res, req.language);

      }, false, true);

};