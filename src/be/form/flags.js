'use strict';

var formOps = require('../engine/formOps');
var url = require('url');
var jsonBuilder = require('../engine/jsonBuilder');
var miscOps = require('../engine/miscOps');
var boardOps = require('../engine/boardOps').flags;
var dom = require('../engine/domManipulator').dynamicPages.managementPages;

function getFlagData(parameters, userData, res) {

  boardOps.getFlagsData(userData, parameters.boardUri, function gotFlagData(
      error, flags) {
    if (error) {
      formOps.outputError(error, 500, res);
    } else {
      var json = parameters.json;

      res.writeHead(200, miscOps.corsHeader(json ? 'application/json'
          : 'text/html'));

      if (json) {
        res.end(jsonBuilder.flagManagement(flags));
      } else {
        res.end(dom.flagManagement(parameters.boardUri, flags));
      }

    }
  });

}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, false,
      function gotData(auth, userData) {

        var parameters = url.parse(req.url, true).query;

        getFlagData(parameters, userData, res);

      });

};