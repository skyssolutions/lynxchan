'use strict';

var formOps = require('../engine/formOps');
var url = require('url');
var miscOps = require('../engine/miscOps');
var dom = require('../engine/domManipulator').dynamicPages.moderationPages;
var modOps = require('../engine/modOps').hashBan;

function getHashBans(userData, parameters, res) {

  modOps.getHashBans(userData, parameters,
      function gotHashBans(error, hashBans) {
        if (error) {
          formOps.outputError(error, res);
        } else {
          res.writeHead(200, miscOps.corsHeader('text/html'));

          res.end(dom.hashBans(hashBans, parameters.boardUri));
        }
      });

}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, false,
      function gotData(auth, userData) {

        var parameters = url.parse(req.url, true).query;

        getHashBans(userData, parameters, res);

      });

};