'use strict';

var formOps = require('../engine/formOps');
var url = require('url');
var miscOps = require('../engine/miscOps');
var boardOps = require('../engine/boardOps').flags;
var dom = require('../engine/domManipulator').dynamicPages.managementPages;

exports.getFlagData = function(parameters, userData, res, auth, language) {

  var json = parameters.json;

  boardOps.getFlagsData(userData, parameters.boardUri, language,
      function gotFlagData(error, flags) {
        if (error) {
          formOps.outputError(error, 500, res, language, json, auth);
        } else {

          if (json) {
            formOps.outputResponse('ok', flags, res, null, auth, null, true);
          } else {
            res.writeHead(200, miscOps.getHeader('text/html', auth));
            res.end(dom.flagManagement(parameters.boardUri, flags, language));
          }

        }
      });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, false,
      function gotData(auth, userData) {

        var parameters = url.parse(req.url, true).query;

        exports.getFlagData(parameters, userData, res, auth, req.language);

      }, false, false, true);

};