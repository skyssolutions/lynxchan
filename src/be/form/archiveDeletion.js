'use strict';

var formOps = require('../engine/formOps');
var miscOps = require('../engine/miscOps');
var lang = require('../engine/langOps').languagePack();
var domManipulator = require('../engine/domManipulator');

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, false,
      function gotData(auth, userData) {

        var allowedToDelete = userData.globalRole < 2;

        if (!allowedToDelete) {
          formOps.outputError(lang.errDeniedArchiveDeletion, 500, res);
        } else {
          res.writeHead(200, miscOps.corsHeader('text/html'));

          res.end(domManipulator.archiveDeletion());
        }
      });
};