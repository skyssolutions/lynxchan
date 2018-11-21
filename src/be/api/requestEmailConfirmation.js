'use strict';

var apiOps = require('../engine/apiOps');
var formOps = require('../engine/formOps');
var accountOps = require('../engine/accountOps');

exports.requestConfirmation = function(domain, auth, userData, res, language) {

  accountOps.requestConfirmation(domain, language, userData,
      function restartedSocket(error) {
        if (error) {
          apiOps.outputError(error, res, auth);
        } else {
          apiOps.outputResponse(auth, null, 'ok', res);
        }
      });

};

exports.process = function(req, res) {

  apiOps.getAuthenticatedData(req, res, function gotData(auth, userData) {
    exports.requestConfirmation(formOps.getDomain(req), auth, userData, res,
        req.language);
  });
};