'use strict';

var formOps = require('../engine/formOps');
var miscOps = require('../engine/miscOps');
var bypassOps = require('../engine/bypassOps');
var domManipulator = require('../engine/domManipulator').dynamicPages.miscPages;
var enabled = require('../settingsHandler').getGeneralSettings().bypassMode;
var lang = require('../engine/langOps').languagePack();

exports.process = function(req, res) {

  if (!enabled) {
    formOps.outputError(lang.errDisabledBypass, 500, res);

    return;
  }

  bypassOps.checkBypass(formOps.getCookies(req).bypass, function checkedBypass(
      error, valid) {

    if (error) {
      formOps.outputError(error, 500, res);
    } else {
      res.writeHead(200, miscOps.corsHeader('text/html'));

      res.end(domManipulator.blockBypass(valid));
    }

  });

};