'use strict';

var formOps = require('../engine/formOps');
var url = require('url');
var jsonBuilder = require('../engine/jsonBuilder');
var miscOps = require('../engine/miscOps');
var dom = require('../engine/domManipulator').dynamicPages.managementPages;
var languageOps = require('../engine/langOps');

exports.getLanguages = function(auth, parameters, userData, res, language) {

  var json = parameters.json;

  languageOps.getLanguagesData(userData.globalRole, language,
      function gotLanguages(error, languages) {
        if (error) {
          formOps.outputError(error, 500, res, language, json, auth);
        } else {

          res.writeHead(200, miscOps.getHeader(json ? 'application/json'
              : 'text/html', auth));

          if (json) {
            res.end(jsonBuilder.languages(languages));
          } else {
            res.end(dom.languages(languages, language));
          }

        }
      });
};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, false,
      function gotData(auth, userData) {
        var parameters = url.parse(req.url, true).query;

        exports.getLanguages(auth, parameters, userData, res, req.language);
      }, false, false, true);
};