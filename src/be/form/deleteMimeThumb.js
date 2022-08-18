'use strict';

var formOps = require('../engine/formOps');
var mimeThumbOps = require('../engine/mimeThumbsOps');
var lang = require('../engine/langOps').languagePack;

exports.deleteMimeThumb = function(parameters, userData, res, auth, language,
    json) {

  mimeThumbOps.deleteThumb(userData, parameters, language,
      function deletedThumb(error, board) {
        if (error) {
          formOps.outputError(error, 500, res, language, json, auth);
        } else {

          formOps
              .outputResponse(json ? 'ok' : lang(language).msgThumbDeleted,
                  json ? null : '/customThumbs.js', res, null, auth, language,
                  json);
        }
      });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {
    exports.deleteMimeThumb(parameters, userData, res, auth, req.language,
        formOps.json(req));
  });

};