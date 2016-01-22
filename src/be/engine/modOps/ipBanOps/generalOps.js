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

exports.loadDependencies = function() {

  captchaOps = require('../../captchaOps');
  logOps = require('../../logOps');
  common = require('..').common;
  logger = require('../../../logger');
  miscOps = require('../../miscOps');
  lang = require('../../langOps').languagePack();

};

// Section 1: Read range bans {
exports.readRangeBans = function(parameters, callback) {
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
    callback(error, rangeBans);
  });
};

exports.getRangeBans = function(userData, parameters, callback) {

  var isOnGlobalStaff = userData.globalRole < miscOps.getMaxStaffRole();

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
        exports.readRangeBans(parameters, callback);
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
exports.logRangeBanCreation = function(userData, parameters, callback) {

  var pieces = lang.logRangeBan;

  var logMessage = pieces.startPiece.replace('{$login}', userData.login);

  if (parameters.boardUri) {
    logMessage += pieces.boardPiece.replace('{$board}', parameters.boardUri);
  } else {
    logMessage += pieces.globalPiece;
  }

  logMessage += pieces.finalPiece.replace('{$range}', parameters.range
      .join('.'));

  logOps.insertLog({
    user : userData.login,
    global : parameters.boardUri ? false : true,
    time : new Date(),
    description : logMessage,
    type : 'rangeBan',
    boardUri : parameters.boardUri
  }, callback);

};

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

      // style exception,too simple
      bans.insertOne(rangeBan, function insertedBan(error) {
        if (error) {
          callback(error);
        } else {
          exports.logRangeBanCreation(userData, parameters, callback);
        }
      });
      // style exception,too simple

    }

  });

};

exports.checkRangeBanPermission = function(userData, parameters, callback) {

  var isOnGlobalStaff = userData.globalRole < miscOps.getMaxStaffRole();

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
