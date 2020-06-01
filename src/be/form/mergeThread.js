'use strict';

var formOps = require('../engine/formOps');
var lang = require('../engine/langOps').languagePack;
var modOps = require('../engine/modOps').merge;
var mandatoryParameters = [ 'boardUri', 'threadDestination', 'threadSource' ];

exports.mergeThreads = function(user, parameters, res, auth, language, json) {

  if (formOps.checkBlankParameters(parameters, mandatoryParameters, res,
      language, json)) {
    return;
  }

  modOps.merge(parameters, user, language, function(error) {

    if (error) {
      return formOps.outputError(error, 500, res, language, json, auth);
    }

    var redirect = '/' + parameters.boardUri + '/res/';
    redirect += parameters.threadDestination + '.html';

    formOps.outputResponse(json ? 'ok' : lang(language).msgThreadMerged,
        json ? null : redirect, res, null, auth, language, json);

  });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, true, function gotData(auth, userData,
      parameters) {

    exports.mergeThreads(userData, parameters, res, auth, req.language, formOps
        .json(req));

  });

};