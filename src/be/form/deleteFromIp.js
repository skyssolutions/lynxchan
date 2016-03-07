'use strict';

var formOps = require('../engine/formOps');
var lang = require('../engine/langOps').languagePack();
var delOps = require('../engine/deletionOps');
var mandatoryParameters = [ 'ip' ];

function deleteFromIp(userData, parameters, res, auth) {

  if (formOps.checkBlankParameters(parameters, mandatoryParameters, res)) {
    return;
  }

  delOps.deleteFromIp(parameters, userData, function deletedFromIp(error) {

    if (error) {
      formOps.outputError(error, 500, res);
    } else {
      formOps.outputResponse(lang.msgDeletedFromIp, '/globalManagement.js',
          res, null, auth);
    }

  });

}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {

    deleteFromIp(userData, parameters, res, auth);

  });

};