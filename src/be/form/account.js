'use strict';

var formOps = require('../engine/formOps');
var miscOps = require('../engine/miscOps');
var url = require('url');
var domManipulator = require('../engine/domManipulator').dynamicPages.miscPages;

exports.process = function(req, res) {

  formOps.getAuthenticatedPost(req, res, false,
      function gotData(auth, userData) {

        if (formOps.json(req)) {

          var settings = require('../settingsHandler').getGeneralSettings();

          var creationRequirement = settings.boardCreationRequirement;

          var allowed = userData.globalRole <= creationRequirement;

          allowed = allowed || creationRequirement > miscOps.getMaxStaffRole();

          formOps.outputResponse('ok', {
            login : userData.login,
            email : userData.email || '',
            ownedBoards : userData.ownedBoards || [],
            settings : userData.settings || [],
            volunteeredBoards : userData.volunteeredBoards || [],
            disabledLatestPostings : settings.disableLatestPostings || false,
            boardCreationAllowed : allowed,
            globalRole : isNaN(userData.globalRole) ? 4 : userData.globalRole
          }, res, null, auth, null, true);

        } else {

          res.writeHead(200, miscOps.getHeader('text/html', auth));
          res.end(domManipulator.account(userData, req.language));

        }

      }, false, false, true);
};