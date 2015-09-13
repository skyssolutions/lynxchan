'use strict';

var mongo = require('mongodb');
var ObjectID = mongo.ObjectID;
var logger = require('../../logger');
var db = require('../../db');
var boards = db.boards();
var logs = db.logs();
var hashBans = db.hashBans();
var lang;
var common;
var miscOps;

var hashBanArguments = [ {
  field : 'hash',
  length : 32,
  removeHTML : true
} ];

exports.loadDependencies = function() {

  lang = require('../langOps').languagePack();
  common = require('.').common;
  miscOps = require('../miscOps');

};

// Section 1: Hash bans {
exports.readHashBans = function(parameters, callback) {

  hashBans.find({
    boardUri : parameters.boardUri ? parameters.boardUri : {
      $exists : false
    }
  }, {
    md5 : 1
  }).sort({
    md5 : 1
  }).toArray(function gotBans(error, hashBans) {
    callback(error, hashBans);
  });
};

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
      } else if (!common.isInBoardStaff(userData, board, 2)) {
        callback(lang.errDeniedBoardHashBansManagement);
      } else {
        exports.readHashBans(parameters, callback);
      }
    });
  } else if (!isOnGlobalStaff) {
    callback(lang.errDeniedGlobalHashBansManagement);
  } else {
    exports.readHashBans(parameters, callback);
  }
};
// } Section 1: Hash bans

// Section 2: Hash ban {
exports.writeHashBan = function(userData, parameters, callback) {
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
};

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
      } else if (!common.isInBoardStaff(userData, board, 2)) {
        callback(lang.errDeniedBoardHashBansManagement);
      } else {
        exports.writeHashBan(userData, parameters, callback);
      }
    });
  } else if (!isOnGlobalStaff) {
    callback(lang.errDeniedGlobalHashBansManagement);
  } else {
    exports.writeHashBan(userData, parameters, callback);
  }

};
// } Section 2: Hash ban

// Section 3: Lift hash ban {
exports.removeHashBan = function(hashBan, userData, callback) {
  hashBans.deleteOne({
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
};

exports.checkForBoardHashBanLiftPermission = function(hashBan, userData,
    callback) {
  boards.findOne({
    boardUri : hashBan.boardUri
  }, function gotBoard(error, board) {
    if (error) {
      callback(error);
    } else if (!board) {
      callback();
    } else {

      if (common.isInBoardStaff(userData, board, 2)) {
        exports.removeHashBan(hashBan, userData, callback);
      } else {
        callback(lang.errDeniedBoardHashBansManagement);
      }
    }
  });
};

exports.liftHashBan = function(userData, parameters, cb) {
  try {
    var globalStaff = userData.globalRole < miscOps.getMaxStaffRole();

    hashBans.findOne({
      _id : new ObjectID(parameters.hashBanId)
    }, function gotHashBan(error, hashBan) {
      if (error) {
        cb(error);
      } else if (!hashBan) {
        cb();
      } else if (hashBan.boardUri) {

        exports.checkForBoardHashBanLiftPermission(hashBan, userData, cb);

      } else if (!globalStaff) {
        cb(lang.errDeniedGlobalHashBansManagement);
      } else {
        exports.removeHashBan(hashBan, userData, cb);
      }
    });
  } catch (error) {
    cb(error);
  }
};
// } Section 3: Lift hash ban

// Section 4: Check for hash ban {
exports.getProcessedBans = function(foundBans, files) {

  var processedBans = [];

  for (var i = 0; i < foundBans.length; i++) {

    var foundBan = foundBans[i];

    for (var j = 0; j < files.length; j++) {

      var file = files[j];

      if (file.md5 === foundBan.md5) {

        processedBans.push({
          file : file.title,
          boardUri : foundBan.boardUri
        });

        break;
      }

    }

  }

  return processedBans;

};

exports.checkForHashBans = function(parameters, callback) {

  var files = parameters.files;
  var boardUri = parameters.boardUri;

  if (!files.length) {
    callback();
    return;
  }

  var md5s = [];

  for (var i = 0; i < files.length; i++) {
    md5s.push(files[i].md5);
  }

  hashBans.find({
    md5 : {
      $in : md5s
    },
    $or : [ {
      boardUri : {
        $exists : false
      }
    }, {
      boardUri : boardUri
    } ]
  }).toArray(function(error, foundBans) {
    if (error) {
      callback(error);
    } else if (!foundBans.length) {
      callback();
    } else {
      callback(null, exports.getProcessedBans(foundBans, files));
    }

  });

};
// } Section 4: Check for hash ban
