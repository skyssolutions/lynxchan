'use strict';

var formOps = require('../engine/formOps');
var url = require('url');
var miscOps = require('../engine/miscOps');
var jsonBuilder = require('../engine/jsonBuilder');
var dom = require('../engine/domManipulator').dynamicPages.managementPages;
var socket = require('../engine/socketOps');

exports.getSocketData = function(userData, json, res, auth, language) {

  socket.getSocketStatus(userData, language, function gotSocketStatus(error,
      statusData) {
    if (error) {
      formOps.outputError(error, 500, res, language, json);
    } else {

      res.writeHead(200, miscOps.getHeader(json ? 'application/json'
          : 'text/html', auth));

      if (json) {
        res.end(jsonBuilder.socketData(statusData));
      } else {
        res.end(dom.socketData(statusData, language));
      }

    }
  });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, false,
      function gotData(auth, userData) {
        exports.getSocketData(userData, url.parse(req.url, true).query.json,
            res, auth, req.language);
      }, false, false, true);

};