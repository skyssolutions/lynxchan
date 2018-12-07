'use strict';

var formOps = require('../engine/formOps');
var url = require('url');
var miscOps = require('../engine/miscOps');
var domManipulator = require('../engine/domManipulator').dynamicPages.miscPages;
var modOps = require('../engine/modOps').edit;
var mandatoryParameters = [ 'boardUri' ];

exports.getPostingToEdit = function(userData, parameters, res, auth, language) {

  if (formOps.checkBlankParameters(parameters, mandatoryParameters, res,
      language, json)) {
    return;
  }

  var json = parameters.json;

  modOps.getPostingToEdit(userData, parameters, language,
      function gotPostingToEdit(error, posting) {
        if (error) {
          formOps.outputError(error, 500, res, language, json, auth);
        } else {

          if (json) {
            formOps.outputResponse('ok', {
              message : posting.message,
              subject : posting.subject
            }, res, null, auth, null, true);
          } else {
            res.writeHead(200, miscOps.getHeader('text/html', auth));
            res.end(domManipulator.edit(parameters, posting, language));
          }

        }
      });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, false, function gotData(auth, user) {

    var parameters = url.parse(req.url, true).query;

    exports.getPostingToEdit(user, parameters, res, auth, req.language);

  }, false, false, true);

};