'use strict';

var formOps = require('../engine/formOps');
var lang = require('../engine/langOps').languagePack;
var logger = require('../logger');
var modOps = require('../engine/modOps').ipBan.specific;
var mandatoryParameters = [ 'banId', 'appeal' ];

exports.appealBan = function(ip, parameters, res, language, json) {

  if (formOps.checkBlankParameters(parameters, mandatoryParameters, res,
      language, json)) {
    return;
  }

  modOps.appealBan(ip, parameters, language, function banAppealed(error) {
    if (error) {
      formOps.outputError(error, 500, res, language, json);
    } else {
      formOps.outputResponse(json ? 'ok' : lang(language).msgBanAppealed,
          json ? null : '/', res, null, null, language, json);
    }
  });

};

exports.process = function(req, res) {

  formOps.getPostData(req, res, function gotData(auth, parameters) {
    exports.appealBan(logger.ip(req), parameters, res, req.language, formOps
        .json(req));
  });

};