'use strict';

var formOps = require('../engine/formOps');
var miscOps = require('../engine/miscOps');
var settingsHandler = require('../settingsHandler');
var domManipulator = require('../engine/domManipulator').dynamicPages.miscPages;

exports.outputJson = function(userData, res, auth) {

  var settings = settingsHandler.getGeneralSettings();

  var creationRequirement = settings.boardCreationRequirement;

  var allowed = userData.globalRole <= creationRequirement;

  allowed = allowed || creationRequirement > miscOps.getMaxStaffRole();

  formOps.outputResponse('ok', {
    noCaptchaBan : settings.disableBanCaptcha,
    login : userData.login,
    email : userData.email || '',
    reportFilter : userData.reportFilter || [],
    ownedBoards : userData.ownedBoards || [],
    settings : userData.settings || [],
    volunteeredBoards : userData.volunteeredBoards || [],
    disabledLatestPostings : settings.disableLatestPostings || false,
    boardCreationAllowed : allowed,
    globalRole : isNaN(userData.globalRole) ? 4 : userData.globalRole
  }, res, null, auth, null, true);

};

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, false,
      function gotData(auth, userData) {

        if (!formOps.json(req)) {
          return formOps.dynamicPage(res, domManipulator.account(userData,
              req.language), auth);
        }

        exports.outputJson(userData, res, auth);

      }, false, true);
};