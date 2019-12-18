'use strict';

var url = require('url');
var formOps = require('../engine/formOps');
var delOps = require('../engine/deletionOps').miscDeletions;
var lang = require('../engine/langOps').languagePack;

exports.unlinkSingle = function(auth, userData, req, res) {

  var parameters = url.parse(req.url, true).query;
  var json = parameters.json;

  delOps.singleFile(userData, parameters, req.language, function(error) {

    if (error) {
      formOps.outputError(error, 500, res, req.language, json, auth);
    } else {

      formOps.outputResponse(json ? 'ok' : lang(req.language).msgFileUnlinked,
          json ? null : '/' + parameters.boardUri, res, null, auth,
          req.language, json);
    }

  });
};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, false,
      function gotData(auth, userData) {

        exports.unlinkSingle(auth, userData, req, res);
      });
};