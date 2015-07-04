'use strict';

var formOps = require('../engine/formOps');
var modOps = require('../engine/modOps');
var mandatoryParameters = [ 'hash' ];

function placeHashBan(userData, parameters, res) {

  if (formOps.checkBlankParameters(parameters, mandatoryParameters, res)) {
    return;
  }

  modOps.placeHashBan(userData, parameters, function hashBanPlaced(error) {
    if (error) {
      formOps.outputError(error, 500, res);
    } else {
      var redirectLink = '/hashBans.js';

      if (parameters.boardUri) {
        redirectLink += '?boardUri=' + parameters.boardUri;
      }

      formOps.outputResponse('Hash ban created', redirectLink, res);
    }
  });

}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {

    placeHashBan(userData, parameters, res);

  });

};