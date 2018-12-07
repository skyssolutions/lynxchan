'use strict';

var formOps = require('../engine/formOps');
var socket = require('../engine/socketOps');
var languageOps = require('../engine/langOps');
var lang = languageOps.languagePack;

exports.restartSocket = function(auth, userData, res, language, json) {

  socket.restartSocket(userData, language, function restartedSocket(error) {
    if (error) {
      formOps.outputError(error, 500, res, language, json, auth);
    } else {
      formOps.outputResponse(json ? 'ok' : lang(language).msgSocketRestarted,
          json ? null : '/socketControl.js', res, null, auth, language, json);
    }
  });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, false,
      function gotData(auth, userData) {
        exports.restartSocket(auth, userData, res, req.language, formOps
            .json(req));
      });

};