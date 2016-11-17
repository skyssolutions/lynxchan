'use strict';

var formOps = require('../engine/formOps');
var url = require('url');
var jsonBuilder = require('../engine/jsonBuilder');
var miscOps = require('../engine/miscOps');
var dom = require('../engine/domManipulator').dynamicPages.managementPages;
var languageOps = require('../engine/langOps');

function getLanguages(auth, parameters, userData, res) {

  languageOps.getLanguagesData(userData.globalRole, function gotlanguages(
      error, languages) {
    if (error) {
      formOps.outputError(error, 500, res);
    } else {
      var json = parameters.json;

      res.writeHead(200, miscOps.corsHeader(json ? 'application/json'
          : 'text/html', auth));

      if (json) {
        res.end(jsonBuilder.languages(languages));
      } else {
        res.end(dom.languages(languages));
      }

    }
  });
}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, false,
      function gotData(auth, userData) {
        var parameters = url.parse(req.url, true).query;

        getLanguages(auth, parameters, userData, res);
      });
};