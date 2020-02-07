'use strict';

// handles hash ban operations

var mongo = require('mongodb');
var ObjectID = mongo.ObjectID;
var logger = require('../../logger');
var allowTor;
var db = require('../../db');
var boards = db.boards();
var hashBans = db.hashBans();
var logOps;
var lang;
var common;
var captchaOps;
var redactedModNames;
var miscOps;
var hashBanLimit;

exports.hashBanArguments = [ {
  field : 'hash',
  length : 64,
  removeHTML : true
}, {
  field : 'reason',
  length : 32,
  removeHTML : true
} ];

exports.loadSettings = function() {
  var settings = require('../../settingsHandler').getGeneralSettings();

  redactedModNames = settings.redactModNames;
  allowTor = settings.allowTorFiles;
  hashBanLimit = settings.maxBoardHashBans;
};

exports.loadDependencies = function() {

  captchaOps = require('../captchaOps');
  logOps = require('../logOps');
  lang = require('../langOps').languagePack;
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
    projection : {
      sha256 : 1,
      reason : 1,
      date : 1,
      user : 1
    }
  }).sort({
    sha256 : 1
  }).toArray(function gotBans(error, hashBans) {
    callback(error, hashBans);
  });
};

exports.getHashBans = function(userData, parameters, language, callback) {

  var isOnGlobalStaff = userData.globalRole < miscOps.getMaxStaffRole();

  if (parameters.boardUri) {

    parameters.boardUri = parameters.boardUri.toString();

    boards.findOne({
      boardUri : parameters.boardUri
    }, function gotBoard(error, board) {
      if (error) {
        callback(error);
      } else if (!board) {
        callback(lang(language).errBoardNotFound);
      } else if (!common.isInBoardStaff(userData, board, 2)) {
        callback(lang(language).errDeniedBoardHashBansManagement);
      } else {
        exports.readHashBans(parameters, callback);
      }
    });
  } else if (!isOnGlobalStaff) {
    callback(lang(language).errDeniedGlobalHashBansManagement);
  } else {
    exports.readHashBans(parameters, callback);
  }
};
// } Section 1: Hash bans

// Section 2: Hash ban {
exports.writeHashBan = function(userData, parameters, callback) {

  var hashBan = {
    sha256 : parameters.hash,
    reason : parameters.reason,
    user : userData.login,
    date : new Date()
  };

  if (parameters.boardUri) {
    hashBan.boardUri = parameters.boardUri;
  }

  hashBans.insertOne(hashBan, function insertedBan(error) {
    if (error && error.code !== 11000) {
      callback(error);
    } else {
      callback(null, hashBan._id);
    }
  });
};

exports.placeHashBan = function(userData, parameters, language, callback,
    checkedHashCount) {

  miscOps.sanitizeStrings(parameters, exports.hashBanArguments);

  var isOnGlobalStaff = userData.globalRole < miscOps.getMaxStaffRole();

  if (parameters.boardUri) {

    if (!checkedHashCount) {
      parameters.boardUri = parameters.boardUri.toString();

      hashBans.countDocuments({
        boardUri : parameters.boardUri
      }, function gotCount(error, count) {

        if (error) {
          callback(error);
        } else if (count >= hashBanLimit) {
          callback(lang(language).errHashBanLimit);
        } else {
          exports.placeHashBan(userData, parameters, language, callback, true);
        }

      });

      return;
    }

    boards.findOne({
      boardUri : parameters.boardUri
    }, function gotBoard(error, board) {
      if (error) {
        callback(error);
      } else if (!board) {
        callback(lang(language).errBoardNotFound);
      } else if (!common.isInBoardStaff(userData, board, 2)) {
        callback(lang(language).errDeniedBoardHashBansManagement);
      } else {
        exports.writeHashBan(userData, parameters, callback);
      }
    });
  } else if (!isOnGlobalStaff) {
    callback(lang(language).errDeniedGlobalHashBansManagement);
  } else {
    exports.writeHashBan(userData, parameters, callback);
  }

};
// } Section 2: Hash ban

// Section 3: Lift hash ban {
exports.removeHashBan = function(hashBan, userData, callback) {

  hashBans.deleteOne({
    _id : hashBan._id
  }, function hashBanRemoved(error) {

    if (error) {
      callback(error);
    } else {

      // style exception, too simple
      var pieces = lang().logLiftHashBan;

      var logMessage = pieces.startPiece.replace('{$login}',
          redactedModNames ? lang().guiRedactedName : userData.login);

      if (hashBan.boardUri) {
        logMessage += pieces.boardPiece.replace('{$board}', hashBan.boardUri);
      } else {
        logMessage += pieces.globalPiece;
      }

      logMessage += pieces.finalPiece.replace('{$hash}', hashBan.sha256);

      logOps.insertLog({
        user : userData.login,
        global : hashBan.boardUri ? false : true,
        time : new Date(),
        description : logMessage,
        type : 'hashBanLift',
        boardUri : hashBan.boardUri
      }, function insertedLog() {

        callback(null, hashBan.boardUri);
      });
      // style exception, too simple

    }

  });

};

exports.checkForBoardHashBanLiftPermission = function(hashBan, userData,
    language, callback) {

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
        callback(lang(language).errDeniedBoardHashBansManagement);
      }
    }
  });

};

exports.liftHashBan = function(userData, parameters, language, cb) {

  try {
    parameters.hashBanId = new ObjectID(parameters.hashBanId);
  } catch (error) {
    cb();
    return;
  }

  var globalStaff = userData.globalRole < miscOps.getMaxStaffRole();

  hashBans.findOne({
    _id : parameters.hashBanId
  }, function gotHashBan(error, hashBan) {
    if (error) {
      cb(error);
    } else if (!hashBan) {
      cb();
    } else if (hashBan.boardUri) {

      exports.checkForBoardHashBanLiftPermission(hashBan, userData, language,
          cb);

    } else if (!globalStaff) {
      cb(lang(language).errDeniedGlobalHashBansManagement);
    } else {
      exports.removeHashBan(hashBan, userData, cb);
    }
  });

};
// } Section 3: Lift hash ban

// Section 4: Check for hash ban {
exports.getProcessedBans = function(foundBans, files) {

  var processedBans = [];

  for (var i = 0; i < foundBans.length; i++) {

    var foundBan = foundBans[i];

    for (var j = 0; j < files.length; j++) {

      var file = files[j];

      if (file.sha256 === foundBan.sha256) {

        processedBans.push({
          file : file.title,
          reason : foundBan.reason,
          boardUri : foundBan.boardUri
        });

        break;
      }

    }

  }

  return processedBans;

};

exports.getFileData = function(parameters) {

  var metadata = parameters.files.metadata;

  var bareInfo = [];

  if (!metadata.length) {

    var fileData = parameters.files.files;

    for (var i = 0; i < fileData.length; i++) {

      if (!fileData[i].size) {
        continue;
      }

      bareInfo.push({
        title : fileData[i].originalFilename,
        sha256 : fileData[i].sha256
      });
    }

    return bareInfo;

  }

  for (i = 0; i < metadata.length; i++) {
    bareInfo.push({
      title : metadata[i].title,
      sha256 : metadata[i].sha256
    });
  }

  return bareInfo;

};

exports.checkForHashBans = function(parameters, req, callback) {

  var fileData = exports.getFileData(parameters);

  if (!fileData.length) {
    return callback();
  } else if (!allowTor && req.isTor) {
    return callback(lang(req.language).errTorFilesBlocked);
  }

  var sha256s = [];

  for (var i = 0; i < fileData.length; i++) {
    sha256s.push(fileData[i].sha256);
  }

  hashBans.find({
    sha256 : {
      $in : sha256s
    },
    $or : [ {
      boardUri : {
        $exists : false
      }
    }, {
      boardUri : parameters.boardUri
    } ]
  }).toArray(function(error, foundBans) {
    if (error) {
      callback(error);
    } else if (!foundBans.length) {
      callback();
    } else {
      callback(null, exports.getProcessedBans(foundBans, fileData));
    }

  });

};
// } Section 4: Check for hash ban
