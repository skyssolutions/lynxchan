'use strict';

var formOps = require('../engine/formOps');
var modOps = require('../engine/modOps');

function placeRangeBan(userData, parameters, res) {

  modOps.placeRangeBan(userData, parameters, function rangeBanPlaced(error) {
    if (error) {
      formOps.outputError(error, 500, res);
    } else {
      var redirectLink = '/rangeBans.js';

      if (parameters.boardUri) {
        redirectLink += '?boardUri=' + parameters.boardUri;
      }

      formOps.outputResponse('Range ban created', redirectLink, res);
    }
  });

}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {

    placeRangeBan(userData, parameters, res);

  });

};