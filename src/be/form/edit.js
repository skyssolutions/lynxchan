'use strict';

var formOps = require('../engine/formOps');
var url = require('url');
var miscOps = require('../engine/miscOps');
var jsonBuilder = require('../engine/jsonBuilder');
var domManipulator = require('../engine/domManipulator').dynamicPages.miscPages;
var modOps = require('../engine/modOps').edit;

function getPostingToEdit(userData, parameters, res) {

  modOps.getPostingToEdit(userData, parameters, function gotPostingToEdit(
      error, message) {
    if (error) {
      formOps.outputError(error, res);
    } else {
      var json = parameters.json;

      res.writeHead(200, miscOps.corsHeader(json ? 'application/json'
          : 'text/html'));

      if (json) {
        res.end(jsonBuilder.edit(message));
      } else {
        res.end(domManipulator.edit(parameters, message));
      }

    }
  });

}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, false,
      function gotData(auth, userData) {

        var parameters = url.parse(req.url, true).query;

        getPostingToEdit(userData, parameters, res);

      });

};