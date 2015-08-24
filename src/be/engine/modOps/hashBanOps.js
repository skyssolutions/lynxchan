'use strict';

var mongo = require('mongodb');
var ObjectID = mongo.ObjectID;
var miscOps = require('../miscOps');
var logger = require('../../logger');
var common = require('.').common;
var lang = require('../langOps').languagePack();
var db = require('../../db');
var boards = db.boards();
var logs = db.logs();
var hashBans = db.hashBans();

var hashBanArguments = [ {
  field : 'hash',
  length : 32,
  removeHTML : true
} ];

// Section 1: Hash bans {
function getHashBans(parameters, callback) {

  hashBans.find({
    boardUri : parameters.boardUri ? parameters.boardUri : {
      $exists : false
    }
  }).sort({
    md5 : 1
  }).toArray(function gotBans(error, hashBans) {
    callback(error, hashBans);
  });
}

exports.getHashBans = function(userData, parameters, callback) {

  var isOnGlobalStaff = userData.globalRole < miscOps.getMaxStaffRole();

  if (parameters.boardUri) {
    boards.findOne({
      boardUri : parameters.boardUri
    }, function gotBoard(error, board) {
      if (error) {
        callback(error);
      } else if (!board) {
        callback(lang.errBoardNotFound);
      } else if (!common.isInBoardStaff(userData, board)) {
        callback(lang.errDeniedBoardHashBansManagement);
      } else {
        getHashBans(parameters, callback);
      }
    });
  } else if (!isOnGlobalStaff) {
    callback(lang.errDeniedGlobalHashBansManagement);
  } else {
    getHashBans(parameters, callback);
  }
};
// } Section 1: Hash bans

// Section 2: Hash ban {
function placeHashBan(userData, parameters, callback) {
  var hashBan = {
    md5 : parameters.hash
  };

  if (parameters.boardUri) {
    hashBan.boardUri = parameters.boardUri;
  }

  hashBans.insert(hashBan, function insertedBan(error) {
    if (error && error.code !== 11000) {
      callback(error);
    } else if (error) {
      callback();
    } else {
      var pieces = lang.logHashBan;

      var logMessage = pieces.startPiece.replace('{$login}', userData.login);

      if (parameters.boardUri) {
        logMessage += pieces.boardPiece
            .replace('{$board}', parameters.boardUri);
      } else {
        logMessage += pieces.globalPiece;
      }

      logMessage += pieces.finalPiece.replace('{$hash}', parameters.hash);

      // style exception,too simple
      logs.insert({
        user : userData.login,
        global : parameters.boardUri ? false : true,
        time : new Date(),
        description : logMessage,
        type : 'hashBan',
        boardUri : parameters.boardUri
      }, function insertedLog(error) {
        if (error) {

          logger.printLogError(logMessage, error);
        }

        callback();
      });
      // style exception,too simple

    }
  });
}

exports.placeHashBan = function(userData, parameters, callback) {

  miscOps.sanitizeStrings(parameters, hashBanArguments);

  var isOnGlobalStaff = userData.globalRole < miscOps.getMaxStaffRole();

  if (parameters.boardUri) {
    boards.findOne({
      boardUri : parameters.boardUri
    }, function gotBoard(error, board) {
      if (error) {
        callback(error);
      } else if (!board) {
        callback(lang.errBoardNotFound);
      } else if (!common.isInBoardStaff(userData, board)) {
        callback(lang.errDeniedBoardHashBansManagement);
      } else {
        placeHashBan(userData, parameters, callback);
      }
    });
  } else if (!isOnGlobalStaff) {
    callback(lang.errDeniedGlobalHashBansManagement);
  } else {
    placeHashBan(userData, parameters, callback);
  }

};
// } Section 2: Hash ban

// Section 3: Lift hash ban {
function liftHashBan(hashBan, userData, callback) {
  hashBans.remove({
    _id : new ObjectID(hashBan._id)
  }, function hashBanRemoved(error) {

    if (error) {
      callback(error);
    } else {

      // style exception, too simple
      var pieces = lang.logLiftHashBan;

      var logMessage = pieces.startPiece.replace('{$login}', userData.login);

      if (hashBan.boardUri) {
        logMessage += pieces.boardPiece.replace('{$board}', hashBan.boardUri);
      } else {
        logMessage += pieces.globalPiece;
      }

      logMessage += pieces.finalPiece.replace('{$hash}', hashBan.md5);

      logs.insert({
        user : userData.login,
        global : hashBan.boardUri ? false : true,
        time : new Date(),
        description : logMessage,
        type : 'hashBanLift',
        boardUri : hashBan.boardUri
      }, function insertedLog(error) {
        if (error) {

          logger.printLogError(logMessage, error);
        }

        callback(null, hashBan.boardUri);
      });
      // style exception, too simple

    }

  });
}

function checkForBoardHashBanLiftPermission(hashBan, userData, callback) {
  boards.findOne({
    boardUri : hashBan.boardUri
  }, function gotBoard(error, board) {
    if (error) {
      callback(error);
    } else if (!board) {
      callback();
    } else {

      if (common.isInBoardStaff(userData, board)) {
        liftHashBan(hashBan, userData, callback);
      } else {
        callback(lang.errDeniedBoardHashBansManagement);
      }
    }
  });
}

exports.liftHashBan = function(userData, parameters, callback) {
  try {
    var globalStaff = userData.globalRole < miscOps.getMaxStaffRole();

    hashBans.findOne({
      _id : new ObjectID(parameters.hashBanId)
    }, function gotHashBan(error, hashBan) {
      if (error) {
        callback(error);
      } else if (!hashBan) {
        callback();
      } else if (hashBan.boardUri) {

        checkForBoardHashBanLiftPermission(hashBan, userData, callback);

      } else if (!globalStaff) {
        callback(lang.errDeniedGlobalHashBansManagement);
      } else {
        liftHashBan(hashBan, userData, callback);
      }
    });
  } catch (error) {
    callback(error);
  }
};
// } Section 3: Lift hash ban
