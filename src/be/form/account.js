'use strict';

var formOps = require('../engine/formOps');
var miscOps = require('../engine/miscOps');
var jsonBuilder = require('../engine/jsonBuilder');
var url = require('url');
var domManipulator = require('../engine/domManipulator').dynamicPages.miscPages;

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, false,
      function gotData(auth, userData) {

        var json = url.parse(req.url, true).query.json;

        res.writeHead(200, miscOps.corsHeader(json ? 'application/json'
            : 'text/html'));

        if (json) {
          res.end(jsonBuilder.account(userData));
        } else {
          res.end(domManipulator.account(userData));
        }

      });
};