'use strict';

var dom = require('../engine/domManipulator').dynamicPages.managementPages;
var formOps = require('../engine/formOps');
var url = require('url');
var miscOps = require('../engine/miscOps');

exports.getManagementData = function(userData, res, json, auth, language) {

  miscOps.getManagementData(userData.globalRole, language, userData.login,
      !json, function gotData(error, globalStaff, globalReports, appealedBans) {
        if (error) {
          formOps.outputError(error, 500, res, language, json, auth);
        } else {

          if (json) {

            formOps.outputResponse('ok', {
              login : userData.login,
              staff : globalStaff || [],
              appealedBans : appealedBans || [],
              reports : globalReports || []
            }, res, null, auth, language, true);

          } else {
            res.writeHead(200, miscOps.getHeader('text/html', auth));

            res.end(dom.globalManagement(userData.globalRole, userData.login,
                globalStaff, globalReports, appealedBans, language));
          }

        }
      });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, false, function gotData(auth,
      userData, parameters) {

    exports.getManagementData(userData, res,
        url.parse(req.url, true).query.json, auth, req.language);

  }, false, false, true);

};