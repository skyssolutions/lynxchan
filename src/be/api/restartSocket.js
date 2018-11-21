'use strict';

var apiOps = require('../engine/apiOps');
var boardOps = require('../engine/boardOps').filters;
var socket = require('../engine/socketOps');

exports.restartSocket = function(auth, userData, res, language) {

  socket.restartSocket(userData, language, function restartedSocket(error) {
    if (error) {
      apiOps.outputError(error, res, auth);
    } else {
      apiOps.outputResponse(auth, null, 'ok', res);
    }
  });

};

exports.process = function(req, res) {

  apiOps.getAuthenticatedData(req, res, function gotData(auth, userData) {
    exports.restartSocket(auth, userData, res, req.language);
  });
};