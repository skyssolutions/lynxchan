'use strict';

var domManipulator = require('../engine/domManipulator').dynamicPages;
var formOps = require('../engine/formOps');
var miscOps = require('../engine/miscOps');

function getManagementData(userData, res) {

  miscOps.getManagementData(userData.globalRole, userData.login,
      function gotData(error, globalStaff, globalReports) {
        if (error) {
          formOps.outputError(error, 500, res);
        } else {

          res.writeHead(200, miscOps.corsHeader('text/html'));

          res.end(domManipulator.globalManagement(userData.globalRole,
              userData.login, globalStaff, globalReports));

        }
      });

}

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, false, function gotData(auth,
      userData, parameters) {

    getManagementData(userData, res);

  });

};