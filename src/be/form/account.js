'use strict';

var formOps = require('../engine/formOps');
var miscOps = require('../engine/miscOps');
var jsonBuilder = require('../engine/jsonBuilder');
var url = require('url');
var domManipulator = require('../engine/domManipulator').dynamicPages.miscPages;

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, false,
      function gotData(auth, userData) {

        if (url.parse(req.url, true).query.json) {
          formOps.outputResponse('ok', jsonBuilder.account(userData), res,
              null, auth, null, true);
        } else {

          res.writeHead(200, miscOps.getHeader('text/html', auth));
          res.end(domManipulator.account(userData, req.language));

        }

      }, false, false, true);
};