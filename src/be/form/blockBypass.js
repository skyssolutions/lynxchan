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

  var json = url.parse(req.url, true).query.json;

  bypassOps.checkBypass(formOps.getCookies(req).bypass, function checkedBypass(
      error, valid) {

    if (error) {
      formOps.outputError(error, 500, res, req.language, json);
    } else {

      if (json) {
        formOps.outputResponse('ok', jsonBuilder.blockBypass(valid), res, null,
            null, null, true);
      } else {
        res.writeHead(200, miscOps.getHeader('text/html'));
        res.end(domManipulator.blockBypass(valid, req.language));
      }

    }

  });

};