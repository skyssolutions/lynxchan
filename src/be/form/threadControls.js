'use strict';

var formOps = require('../engine/formOps');
var modOps = require('../engine/modOps');

function performActionControl(userData, parameters, res) {

  if (parameters.action.toLowerCase() === 'lock') {

    modOps.setThreadLock(userData, parameters, function threadLockSet(error) {
      if (error) {
        formOps.outputError(error, res);
      } else {
        formOps.outputResponse(parameters.lock ? 'Thread locked'
            : 'Thread unlocked', '/', res);
      }
    });
  } else {

    modOps.setThreadPin(userData, parameters, function threadPinSet(error) {
      if (error) {
        formOps.outputError(error, res);
      } else {
        formOps.outputResponse(parameters.pin ? 'Thread pinned'
            : 'Thread unpinned', '/', res);
      }
    });
  }

}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {

    performActionControl(userData, parameters, res);

  });

};