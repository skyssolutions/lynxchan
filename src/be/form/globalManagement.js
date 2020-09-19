'use strict';

var dom = require('../engine/domManipulator').dynamicPages.broadManagement;
var formOps = require('../engine/formOps');
var url = require('url');
var miscOps = require('../engine/miscOps');

exports.getManagementData = function(userData, res, json, auth, language) {

  miscOps.getManagementData(userData, language, function gotData(error,
      globalStaff, appealedBanCount, reportCount) {
    if (error) {
      return formOps.outputError(error, 500, res, language, json, auth);
    }

    if (json) {

      formOps.outputResponse('ok', {
        login : userData.login,
        staff : globalStaff || [],
        appealedBans : appealedBanCount,
        openReports : reportCount
      }, res, null, auth, language, true);

    } else {

      return formOps.dynamicPage(res,
          dom.globalManagement(userData.globalRole, userData.login,
              globalStaff, appealedBanCount, reportCount, language), auth);

    }

  });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, false, function gotData(auth,
      userData, parameters) {

    exports.getManagementData(userData, res,
        url.parse(req.url, true).query.json, auth, req.language);

  }, false, true);

};