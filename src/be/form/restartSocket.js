'use strict';

var formOps = require('../engine/formOps');
var socket = require('../engine/socketOps');
var languageOps = require('../engine/langOps');
var lang = languageOps.languagePack;

exports.restartSocket = function(auth, userData, res, language) {

  socket.restartSocket(userData, language, function restartedSocket(error) {
    if (error) {
      formOps.outputError(error, 500, res, language);
    } else {
      formOps.outputResponse(lang(language).msgSocketRestarted,
          '/socketControl.js', res, null, auth, language);
    }
  });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, false,
      function gotData(auth, userData) {
        exports.restartSocket(auth, userData, res, req.language);
      });

};