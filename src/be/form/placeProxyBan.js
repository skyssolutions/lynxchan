'use strict';

var formOps = require('../engine/formOps');
var lang = require('../engine/langOps').languagePack();
var modOps = require('../engine/modOps').ipBan;
var mandatoryParameters = [ 'proxyIp' ];

function placeProxyBan(userData, parameters, res) {

  if (formOps.checkBlankParameters(parameters, mandatoryParameters, res)) {
    return;
  }

  modOps.placeProxyBan(userData, parameters, function proxyBanPlaced(error) {
    if (error) {
      formOps.outputError(error, 500, res);
    } else {
      var redirectLink = '/proxyBans.js';

      if (parameters.boardUri) {
        redirectLink += '?boardUri=' + parameters.boardUri;
      }

      formOps.outputResponse(lang.msgProxyBanCreated, redirectLink, res);
    }
  });

}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {

    placeProxyBan(userData, parameters, res);

  });

};