'use strict';

var formOps = require('../engine/formOps');
var lang = require('../engine/langOps').languagePack;
var mimeThumbOps = require('../engine/mimeThumbsOps');
var mandatoryParameters = [ 'mime' ];

exports.thumb = function(userData, params, language, auth, json, res) {

  if (formOps.checkBlankParameters(params, mandatoryParameters, res, language,
      json)) {
    return;
  }

  mimeThumbOps.addThumb(userData, params, language, function addedThumb(error,
      id) {

    if (error) {
      return formOps.outputError(error, 500, res, language, json, auth);
    }

    formOps.outputResponse(json ? 'ok' : lang(language).msgThumbAdded,
        json ? id : '/customThumbs.js', res, null, auth, language, json);

  });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {

    // style exception, too simple
    formOps.validateMimes(parameters, parameters.files, function(error) {

      var json = formOps.json(req);

      if (error) {
        formOps.outputError(error, 500, res, req.language, json, auth);
      } else {
        exports.thumb(userData, parameters, req.language, auth, json,
            res);
      }

    });
    // style exception, too simple

  });
};