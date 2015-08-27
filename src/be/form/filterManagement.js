'use strict';

var formOps = require('../engine/formOps');
var url = require('url');
var jsonBuilder = require('../engine/jsonBuilder');
var miscOps = require('../engine/miscOps');
var boardOps = require('../engine/boardOps').filters;
var dom = require('../engine/domManipulator').dynamicPages.managementPages;

function getFilterData(parameters, userData, res) {

  boardOps.getFilterData(userData.login, parameters.boardUri,
      function gotFilterData(error, filters) {
        if (error) {
          formOps.outputError(error, 500, res);
        } else {
          var json = parameters.json;

          res.writeHead(200, miscOps.corsHeader(json ? 'application/json'
              : 'text/html'));

          if (json) {
            res.end(jsonBuilder.filterManagement(filters));
          } else {
            res.end(dom.filterManagement(parameters.boardUri, filters));
          }

        }
      });

}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, false,
      function gotData(auth, userData) {

        var parameters = url.parse(req.url, true).query;

        getFilterData(parameters, userData, res);

      });

};