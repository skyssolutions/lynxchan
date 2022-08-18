'use strict';

var formOps = require('../engine/formOps');
var miscOps = require('../engine/miscOps');
var settingsHandler = require('../settingsHandler');
var accountOps = require('../engine/accountOps');
var domManipulator = require('../engine/domManipulator').dynamicPages.miscPages;

exports.outputJson = function(userData, reportCount, appealCount, res, auth) {

  var settings = settingsHandler.getGeneralSettings();

  var creationRequirement = settings.boardCreationRequirement;

  var allowed = userData.globalRole <= creationRequirement;

  allowed = allowed || creationRequirement > miscOps.getMaxStaffRole();

  formOps.outputResponse('ok', {
    noCaptchaBan : settings.disableBanCaptcha,
    login : userData.login,
    email : userData.email || '',
    openReports : reportCount,
    appeals : appealCount,
    reportFilter : userData.reportFilter || [],
    ownedBoards : userData.ownedBoards || [],
    settings : userData.settings || [],
    volunteeredBoards : userData.volunteeredBoards || [],
    disabledLatestPostings : settings.disableLatestPostings || false,
    boardCreationAllowed : allowed,
    globalRole : isNaN(userData.globalRole) ? 4 : userData.globalRole
  }, res, null, auth, null, true);

};

exports.getQueueData = function(userData, res, auth, req) {

  accountOps.getQueueInfo(userData, function(error, appeals, openReports) {

    var json = formOps.json(req);

    if (error) {
      return formOps.outputError(error, 500, res, req.language, json, auth);
    }

    if (!json) {
      return formOps.dynamicPage(res, domManipulator.account(userData,
          req.language, openReports, appeals), auth);
    }

    exports.outputJson(userData, openReports, appeals, res, auth);

  });

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, false,
      function gotData(auth, userData) {

        exports.getQueueData(userData, res, auth, req);

      }, false, true);
};