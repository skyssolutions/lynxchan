'use strict';

var formOps = require('../engine/formOps');
var url = require('url');
var dom = require('../engine/domManipulator').dynamicPages.moderationPages;
var boardOps = require('../engine/boardOps').trashBin;
var jsonBuilder = require('../engine/jsonBuilder');

exports.trash = function(auth, parameters, user, res, language) {

  var json = parameters.json;

  boardOps.getTrash(user, parameters, language, function gotPostings(error,
      threads, posts, latestPosts) {

    if (error) {
      return formOps.outputError(error, 500, res, language, json, auth);
    }

    if (json) {

      formOps.outputResponse('ok', jsonBuilder.trashBin(threads, posts,
          latestPosts), res, null, auth, null, true);
    } else {
      formOps.dynamicPage(res, dom.trashBin(threads, posts, latestPosts,
          parameters, language), auth);
    }

  });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, false,
      function gotData(auth, userData) {
        var parameters = url.parse(req.url, true).query;

        exports.trash(auth, parameters, userData, res, req.language);
      }, false, true);
};