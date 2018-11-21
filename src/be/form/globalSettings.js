'use strict';

var formOps = require('../engine/formOps');
var miscOps = require('../engine/miscOps');
var url = require('url');
var jsonBuilder = require('../engine/jsonBuilder');
var dom = require('../engine/domManipulator').dynamicPages.managementPages;

exports.getGlobalSettings = function(userData, res, json, auth, language) {

  miscOps.getGlobalSettingsData(userData, language, function gotSettingsData(
      error) {
    if (error) {
      formOps.outputError(error, 500, res, language, json, auth);
    } else {
      res.writeHead(200, miscOps.getHeader(json ? 'application/json'
          : 'text/html', auth));

      if (json) {
        res.end(jsonBuilder.globalSettings());
      } else {
        res.end(dom.globalSettings(language));
      }
    }
  });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, false,
      function gotData(auth, userData) {

        exports.getGlobalSettings(userData, res,
            url.parse(req.url, true).query.json, auth, req.language);

      }, false, false, true);

};