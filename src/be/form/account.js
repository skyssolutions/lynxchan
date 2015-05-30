'use strict';

var formOps = require('../engine/formOps');
var miscOps = require('../engine/miscOps');
var domManipulator = require('../engine/domManipulator');

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, false,
      function gotData(auth, userData) {

        res.writeHead(200, miscOps.corsHeader('text/html'));

        res.end(domManipulator.account(userData.globalRole, userData.login,
            userData.ownedBoards));

      });

};