'use strict';

var url = require('url');
var formOps = require('../engine/formOps');
var miscOps = require('../engine/miscOps');
var bypassOps = require('../engine/bypassOps');
var domManipulator = require('../engine/domManipulator').dynamicPages.miscPages;
var jsonBuilder = require('../engine/jsonBuilder');
var settingsHandler = require('../settingsHandler');
var lang = require('../engine/langOps').languagePack;

exports.process = function(req, res) {

  if (!settingsHandler.getGeneralSettings().bypassMode) {
    formOps.outputError(lang(req.language).errDisabledBypass, 500, res,
        req.language);

    return;
  }

  var json = url.parse(req.url, true).query.json;

  bypassOps.checkBypass(formOps.getCookies(req).bypass, function checkedBypass(
      error, valid) {

    if (error) {
      formOps.outputError(error, 500, res, req.language);
    } else {
      res.writeHead(200, miscOps.corsHeader(json ? 'application/json'
          : 'text/html'));

      if (json) {
        res.end(jsonBuilder.blockBypass(valid));
      } else {
        res.end(domManipulator.blockBypass(valid, req.language));
      }

    }

  });

};