'use strict';

var formOps = require('../engine/formOps');
var url = require('url');
var jsonBuilder = require('../engine/jsonBuilder');
var miscOps = require('../engine/miscOps');
var dom = require('../engine/domManipulator').dynamicPages.moderationPages;
var modOps = require('../engine/modOps').hashBan;

function getHashBans(userData, parameters, res, auth) {

  modOps.getHashBans(userData, parameters,
      function gotHashBans(error, hashBans) {
        if (error) {
          formOps.outputError(error, 500, res);
        } else {
          var json = parameters.json;

          res.writeHead(200, miscOps.corsHeader(json ? 'application/json'
              : 'text/html', auth));

          if (json) {
            res.end(jsonBuilder.hashBans(hashBans));
          } else {
            res.end(dom.hashBans(hashBans, parameters.boardUri));
          }

        }
      });

}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, false,
      function gotData(auth, userData) {

        var parameters = url.parse(req.url, true).query;

        getHashBans(userData, parameters, res, auth);

      });

};