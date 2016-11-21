'use strict';

var formOps = require('../engine/formOps');
var url = require('url');
var miscOps = require('../engine/miscOps');
var jsonBuilder = require('../engine/jsonBuilder');
var domManipulator = require('../engine/domManipulator').dynamicPages.miscPages;
var modOps = require('../engine/modOps').edit;
var mandatoryParameters = [ 'boardUri' ];

function getPostingToEdit(userData, parameters, res, auth, language) {

  if (formOps.checkBlankParameters(parameters, mandatoryParameters, res,
      language)) {
    return;
  }

  modOps.getPostingToEdit(userData, parameters, function gotPostingToEdit(
      error, message) {
    if (error) {
      formOps.outputError(error, 500, res, language);
    } else {
      var json = parameters.json;

      res.writeHead(200, miscOps.corsHeader(json ? 'application/json'
          : 'text/html', auth));

      if (json) {
        res.end(jsonBuilder.edit(message));
      } else {
        res.end(domManipulator.edit(parameters, message, language));
      }

    }
  });

}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, false,
      function gotData(auth, userData) {

        var parameters = url.parse(req.url, true).query;

        getPostingToEdit(userData, parameters, res, auth, req.language);

      });

};