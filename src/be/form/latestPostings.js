'use strict';

var formOps = require('../engine/formOps');
var url = require('url');
var jsonBuilder = require('../engine/jsonBuilder');
var miscOps = require('../engine/miscOps');
var dom = require('../engine/domManipulator').dynamicPages.moderationPages;
var boardOps = require('../engine/boardOps').meta;

exports.latestPostings = function(auth, parameters, userData, res, language) {

  boardOps.getLatestPostings(userData, parameters, language,
      function gotPostings(error, postings) {
        if (error) {
          formOps.outputError(error, 500, res, language);
        } else {
          var json = parameters.json;

          res.writeHead(200, miscOps.getHeader(json ? 'application/json'
              : 'text/html', auth));

          if (json) {
            res.end(jsonBuilder.latestPostings(postings));
          } else {
            res.end(dom.latestPostings(postings, parameters, language));
          }

        }
      });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, false,
      function gotData(auth, userData) {
        var parameters = url.parse(req.url, true).query;

        exports.latestPostings(auth, parameters, userData, res, req.language);
      });
};