'use strict';

var formOps = require('../engine/formOps');
var url = require('url');
var dom = require('../engine/domManipulator').dynamicPages.moderationPages;
var boardOps = require('../engine/boardOps').latest;
var jsonBuilder = require('../engine/jsonBuilder');

exports.latestPostings = function(auth, parameters, user, res, language) {

  var json = parameters.json;

  boardOps.getLatestPostings(user, parameters, language, function gotPostings(
      error, postings, pivotPosting, boardData) {
    if (error) {
      return formOps.outputError(error, 500, res, language, json, auth);
    }

    if (json) {

      formOps.outputResponse('ok', jsonBuilder.latestPostings(postings, user,
          boardData), res, null, auth, null, true);
    } else {
      return formOps.dynamicPage(res, dom.latestPostings(postings, parameters,
          user, pivotPosting, boardData, language), auth);
    }

  });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, false,
      function gotData(auth, userData) {
        var parameters = url.parse(req.url, true).query;

        exports.latestPostings(auth, parameters, userData, res, req.language);
      }, false, true);
};