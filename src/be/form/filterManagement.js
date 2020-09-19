'use strict';

var formOps = require('../engine/formOps');
var url = require('url');
var miscOps = require('../engine/miscOps');
var boardOps = require('../engine/boardOps').filters;
var dom = require('../engine/domManipulator').dynamicPages.managementPages;

exports.getFilterData = function(parameters, userData, res, auth, language) {

  var json = parameters.json;

  boardOps.getFilterData(userData, parameters.boardUri, language,
      function gotFilterData(error, filters) {
        if (error) {
          formOps.outputError(error, 500, res, language, json, auth);
        } else {

          if (json) {
            formOps.outputResponse('ok', filters, res, null, auth, null, true);
          } else {

            return formOps.dynamicPage(res, dom.filterManagement(
                parameters.boardUri, filters, language), auth);

          }

        }
      });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, false,
      function gotData(auth, userData) {

        var parameters = url.parse(req.url, true).query;

        exports.getFilterData(parameters, userData, res, auth, req.language);

      }, false, true);

};