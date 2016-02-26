'use strict';

var mongo = require('mongodb');
var ObjectID = mongo.ObjectID;
var db = require('../../../db');
var bans = db.bans();
var boards = db.boards();
var miscOps;
var common;
var logger;
var logOps;
var captchaOps;
var lang;
var minClearIpRole;

exports.loadSettings = function() {

  var settings = require('../../../settingsHandler').getGeneralSettings();
  minClearIpRole = settings.clearIpMinRole;

};

exports.loadDependencies = function() {

  captchaOps = require('../../captchaOps');
  logOps = require('../../logOps');
  common = require('..').common;
  logger = require('../../../logger');
  miscOps = require('../../miscOps');
  lang = require('../../langOps').languagePack();

};

// Section 1: Read range bans {
exports.readRangeBans = function(parameters, callback, boardData) {
  var queryBlock = {
    range : {
      $exists : true
    },
    boardUri : parameters.boardUri ? parameters.boardUri : {
      $exists : false
    }
  };

  bans.find(queryBlock, {
    range : 1
  }).sort({
    creation : -1
  }).toArray(function gotBans(error, rangeBans) {
    callback(error, rangeBans, boardData);
  });
};

exports.getRangeBans = function(userData, parameters, callback) {

  var isOnGlobalStaff = userData.globalRole <= minClearIpRole;

  if (parameters.boardUri) {

    parameters.boardUri = parameters.boardUri.toString();

    boards.findOne({
      boardUri : parameters.boardUri
    }, function gotBoard(error, board) {
      if (error) {
        callback(error);
      } else if (!board) {
        callback(lang.errBoardNotFound);
      } else if (!common.isInBoardStaff(userData, board, 2)) {
        callback(lang.errDeniedBoardRangeBanManagement);
      } else {
        exports.readRangeBans(parameters, callback, board);
      }
    });
  } else if (!isOnGlobalStaff) {
    callback(lang.errDeniedGlobalRangeBanManagement);
  } else {
    exports.readRangeBans(parameters, callback);
  }

};
// } Section 1: Read range bans

// Section 2: Create range ban {
exports.createRangeBan = function(userData, parameters, callback) {

  parameters.range = miscOps.sanitizeIp(parameters.range);

  if (!parameters.range.length) {
    callback(lang.errInvalidRange);

    return;
  }

  parameters.boardUri = parameters.boardUri ? parameters.boardUri.toString()
      : null;

  bans.findOne({
    range : parameters.range,
    boardUri : parameters.boardUri ? parameters.boardUri : {
      $exists : false
    }
  }, function gotBan(error, ban) {

    if (error) {
      callback(error);
    } else if (ban) {
      callback();
    } else {

      var rangeBan = {
        range : parameters.range,
        appliedBy : userData.login,
      };

      if (parameters.boardUri) {
        rangeBan.boardUri = parameters.boardUri;
      }

      bans.insertOne(rangeBan, callback);

    }

  });

};

exports.checkRangeBanPermission = function(userData, parameters, callback) {

  var isOnGlobalStaff = userData.globalRole <= minClearIpRole;

  if (parameters.boardUri) {

    parameters.boardUri = parameters.boardUri.toString();

    boards.findOne({
      boardUri : parameters.boardUri
    }, function gotBoard(error, board) {
      if (error) {
        callback(error);
      } else if (!board) {
        callback(lang.errBoardNotFound);
      } else if (!common.isInBoardStaff(userData, board, 2)) {
        callback(lang.errDeniedBoardRangeBanManagement);
      } else {
        exports.createRangeBan(userData, parameters, callback);
      }
    });
  } else if (!isOnGlobalStaff) {
    callback(lang.errDeniedGlobalRangeBanManagement);
  } else {
    exports.createRangeBan(userData, parameters, callback);
  }

};

exports.placeRangeBan = function(userData, parameters, captchaId, callback) {

  captchaOps.attemptCaptcha(captchaId, parameters.captcha, null,
      function solvedCaptcha(error) {
        if (error) {
          callback(error);
        } else {
          exports.checkRangeBanPermission(userData, parameters, callback);
        }
      });

};
// } Section 2: Create range ban
