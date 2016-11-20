'use strict';

var formOps = require('../engine/formOps');
var lang = require('../engine/langOps').languagePack();
var logger = require('../logger');
var modOps = require('../engine/modOps').ipBan.specific;
var mandatoryParameters = [ 'banId', 'appeal' ];

function appealBan(ip, parameters, res, language) {

  if (formOps.checkBlankParameters(parameters, mandatoryParameters, res)) {
    return;
  }

  modOps.appealBan(ip, parameters, function banAppealed(error) {
    if (error) {
      formOps.outputError(error, 500, res);
    } else {
      formOps.outputResponse(lang.msgBanAppealed, '/', res, null, null,
          language);
    }
  });

}

exports.process = function(req, res) {

  formOps.getPostData(req, res, function gotData(auth, parameters) {

    appealBan(logger.ip(req), parameters, res, req.language);

  });

};