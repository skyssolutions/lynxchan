'use strict';

var formOps = require('../engine/formOps');
var miscOps = require('../engine/miscOps');
var bypassOps = require('../engine/bypassOps');
var domManipulator = require('../engine/domManipulator').dynamicPages.miscPages;
var settingsHandler = require('../settingsHandler');
var lang = require('../engine/langOps').languagePack();

exports.process = function(req, res) {

  if (!settingsHandler.getGeneralSettings().bypassMode) {
    formOps.outputError(lang.errDisabledBypass, 500, res, req.language);

    return;
  }

  bypassOps.checkBypass(formOps.getCookies(req).bypass, function checkedBypass(
      error, valid) {

    if (error) {
      formOps.outputError(error, 500, res, req.language);
    } else {
      res.writeHead(200, miscOps.corsHeader('text/html'));

      res.end(domManipulator.blockBypass(valid));
    }

  });

};