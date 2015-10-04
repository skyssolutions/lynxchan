'use strict';

var apiOps = require('../engine/apiOps');
var logger = require('../logger');
var modOps = require('../engine/modOps').ipBan.specific;
var mandatoryParameters = [ 'banId', 'appeal' ];

function appealBan(ip, parameters, res) {

  if (apiOps.checkBlankParameters(parameters, mandatoryParameters, res)) {
    return;
  }

  modOps.appealBan(ip, parameters, function banAppealed(error) {
    if (error) {
      apiOps.outputError(error, res);
    } else {
      apiOps.outputResponse(null, null, 'ok', res);
    }
  });

}

exports.process = function(req, res) {

  apiOps.getAnonJsonData(req, res, function gotData(auth, parameters) {

    appealBan(logger.ip(req), parameters, res);

  });

};