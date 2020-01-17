'use strict';

// contains operations common to multiple parts of modOps

var globalBoardModeration;
var maxRoleStaff;

exports.regexRelation = {
  FullYear : new RegExp(/(\d+)y/),
  Month : new RegExp(/(\d+)M/),
  Date : new RegExp(/(\d+)d/),
  Hours : new RegExp(/(\d+)h/),
  Minutes : new RegExp(/(\d+)m/)
};

exports.banArguments = [ {
  field : 'reasonBan',
  length : 256,
  removeHTML : true
}, {
  field : 'banMessage',
  length : 128,
  removeHTML : true
} ];

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

exports.parseExpiration = function(parameters) {

  var expiration = new Date();

  var informedDuration = (parameters.duration || '').toString().trim();

  var foundDuration = false;

  for ( var key in exports.regexRelation) {

    var durationMatch = informedDuration.match(exports.regexRelation[key]);

    if (durationMatch) {
      foundDuration = true;
      expiration['set' + key](expiration['get' + key]() + (+durationMatch[1]));
    }

  }

  if (foundDuration) {
    parameters.expiration = expiration;
  } else {
    delete parameters.expiration;
  }

};