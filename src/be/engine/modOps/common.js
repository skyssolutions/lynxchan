'use strict';

var settings = require('../../boot').getGeneralSettings();
var globalBoardModeration = settings.allowGlobalBoardModeration;
var maxRoleStaff;

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