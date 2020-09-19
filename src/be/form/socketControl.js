'use strict';

var formOps = require('../engine/formOps');
var url = require('url');
var miscOps = require('../engine/miscOps');
var dom = require('../engine/domManipulator').dynamicPages.managementPages;
var socket = require('../engine/socketOps');

exports.getSocketData = function(userData, json, res, auth, language) {

  socket.getSocketStatus(userData, language, function gotSocketStatus(error,
      statusData) {
    if (error) {
      formOps.outputError(error, 500, res, language, json, auth);
    } else {

      if (json) {
        formOps.outputResponse('ok', statusData, res, null, auth, null, true);
      } else {

        formOps.dynamicPage(res, dom.socketData(statusData, language), auth);
      }

    }
  });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, false,
      function gotData(auth, userData) {
        exports.getSocketData(userData, url.parse(req.url, true).query.json,
            res, auth, req.language);
      }, false, true);

};