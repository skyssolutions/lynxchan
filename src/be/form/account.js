'use strict';

var formOps = require('../engine/formOps');
var miscOps = require('../engine/miscOps');
var domManipulator = require('../engine/domManipulator');

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, false, function gotData(error, auth) {
    if (error) {

      var header = [ [ 'Location', '/login.html' ] ];

      res.writeHead(302, header);

      res.end();
    } else {

      res.writeHead(200, miscOps.corsHeader('text/html'));

      res.end(domManipulator.account(auth.login));

    }
  });

};