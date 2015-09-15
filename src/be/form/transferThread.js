'use strict';

var formOps = require('../engine/formOps');
var lang = require('../engine/langOps').languagePack();

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {

    formOps.outputResponse(lang.msgThreadTransferred, '/', res);

  });
};