'use strict';

// contains operations common to multiple parts of modOps

var globalBoardModeration;
var maxRoleStaff;

exports.loadSettings = function() {
  var settings = require('../../settingsHandler').getGeneralSettings();

  globalBoardModeration = settings.allowGlobalBoardModeration;

};

exports.loadDependencies = function() {
  maxRoleStaff = require('../miscOps').getMaxStaffRole();
};

exports.isInBoardStaff = function(userData, board, requiredGlobalRole) {

  if (globalBoardModeration) {

    var minGlobalRoleRequired = requiredGlobalRole || maxRoleStaff;

    var allowedByGlobal = userData.globalRole <= minGlobalRoleRequired;

  }

  var isOwner = board.owner === userData.login;

  var volunteers = board.volunteers || [];

  var isVolunteer = volunteers.indexOf(userData.login) > -1;

  return isOwner || isVolunteer || allowedByGlobal;
};