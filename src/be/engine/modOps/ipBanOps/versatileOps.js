'use strict';

var mongo = require('mongodb');
var ObjectID = mongo.ObjectID;
var db = require('../../../db');
var bans = db.bans();
var taskListener = require('../../../taskListener');
var boards = db.boards();
var torLevel;
var torAllowed;
var bypassAllowed;
var torPassAllowed;
var locationOps;
var bypassMandatory;
var disableFloodCheck;
var logOps;
var lang;
var floodTimer;
var logger;
var minClearIpRole;
var miscOps;
var torOps;
var spamOps;
var verbose;
var common;
var spamBypass;
var globalBoardModeration;
var floodTracking = {};

exports.loadSettings = function() {
  var settings = require('../../../settingsHandler').getGeneralSettings();

  verbose = settings.verbose || settings.verboseMisc;
  floodTimer = settings.floodTimerSec * 1000;
  minClearIpRole = settings.clearIpMinRole;
  torLevel = settings.torPostingLevel;
  torAllowed = torLevel > 0;
  bypassAllowed = settings.bypassMode > 0;
  torPassAllowed = bypassAllowed && torAllowed;
  bypassMandatory = settings.bypassMode > 1;
  disableFloodCheck = settings.disableFloodCheck;
  spamBypass = settings.allowVersatileBlockBypass;
  globalBoardModeration = settings.allowGlobalBoardModeration;

};

exports.loadDependencies = function() {

  locationOps = require('../../locationOps');
  logOps = require('../../logOps');
  common = require('..').common;
  torOps = require('../../torOps');
  logger = require('../../../logger');
  lang = require('../../langOps').languagePack;
  miscOps = require('../../miscOps');
  spamOps = require('../../spamOps');

};

exports.recordFlood = function(task) {
  floodTracking[task.ip] = new Date(task.expiration);
};

exports.cleanFloodRecords = function() {

  var now = new Date();

  var keys = Object.keys(floodTracking);

  for (var i = 0; i < keys.length; i++) {

    var key = keys[i];

    if (floodTracking[key] < now) {
      delete floodTracking[key];
    }

  }

};

exports.masterFloodCheck = function(task, socket) {

  var lastEntry = floodTracking[task.ip];

  var flood = !!(lastEntry && new Date() < lastEntry);

  taskListener.sendToSocket(socket, {
    flood : flood
  });

  if (!flood && task.record) {
    floodTracking[task.ip] = new Date(new Date().getTime() + floodTimer);
  }

};

// Section 1: Bans {
exports.readBans = function(parameters, callback) {

  var queryBlock = {
    ip : {
      $exists : true
    },
    $or : [ {
      expiration : {
        $gt : new Date()
      }
    }, {
      expiration : null
    } ]
  };

  if (parameters.boardUri) {
    queryBlock.boardUri = parameters.boardUri;
  } else if (!globalBoardModeration) {
    queryBlock.boardUri = {
      $exists : false
    };
  }

  bans.find(queryBlock, {
    projection : {
      reason : 1,
      appeal : 1,
      denied : 1,
      boardUri : 1,
      expiration : 1,
      appliedBy : 1
    }
  }).sort({
    creation : -1
  }).toArray(function gotBans(error, bans) {
    callback(error, bans);
  });
};

exports.getBans = function(userData, parameters, language, callback) {

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
        callback(lang(language).errDeniedBoardBanManagement);
      } else {
        exports.readBans(parameters, callback);
      }
    });
  } else if (!isOnGlobalStaff) {
    callback(lang(language).errDeniedGlobalBanManagement);
  } else {
    exports.readBans(parameters, callback);
  }

};
// } Section 1: Bans

// Section 2: Ban check {
exports.getActiveBan = function(ip, asn, boardUri, callback) {

  var singleBanCondition = {
    ip : ip
  };

  var rangeBanCondition = {
    range : {
      $in : [ miscOps.getRange(ip), miscOps.getRange(ip, true) ]
    }
  };

  var globalOrLocalOr = {
    $or : [ {
      boardUri : boardUri
    }, {
      boardUri : null
    } ]
  };

  var expirationOr = {
    $or : [ {
      expiration : {
        $gt : new Date()
      }
    }, {
      expiration : null
    } ]
  };

  var finalCondition = {
    $and : [ globalOrLocalOr, {
      $or : [ rangeBanCondition, singleBanCondition ]
    }, expirationOr ]
  };

  if (asn) {
    finalCondition.$and[1].$or.push({
      asn : asn
    });
  }

  bans.find(finalCondition).toArray(function gotBans(error, bans) {
    if (error) {
      callback(error);
    } else {

      var ban;

      for (var i = 0; i < bans.length; i++) {

        var foundBan = bans[i];

        var genericBan = ban && (ban.asn || ban.range);

        if (!ban || (genericBan && (!foundBan.asn || !foundBan.range))) {
          ban = foundBan;
        }
      }

      var canBypass = bypassAllowed && spamBypass && ban;
      callback(null, ban, canBypass && (ban.asn || ban.range));
    }

  });

};

exports.getASN = function(req, boardUri, callback) {

  var ip = logger.ip(req);

  locationOps.getASN(ip, function gotASN(error, asn) {

    if (error && verbose) {
      console.log(error);
    }

    req.asn = asn;

    exports.getActiveBan(ip, asn, boardUri, callback);

  });

};

exports.receivedFloodCheckResponse = function(req, ip, boardUri, socket, flood,
    callback) {

  if (flood && !disableFloodCheck) {
    callback(lang(req.language).errFlood);
  } else {

    spamOps.checkDnsbl(logger.ip(req), function checked(error, spammer) {

      if (error) {
        callback(error);
      } else if (spammer) {

        if (spamBypass && bypassAllowed) {

          if (!req.bypassed) {
            callback(null, null, true);
          } else {
            exports.getASN(req, boardUri, callback);
          }

        } else {
          callback(lang(req.language).errSpammer);
        }

      } else {
        exports.getASN(req, boardUri, callback);
      }

    });

  }

};

exports.checkForFlood = function(req, boardUri, callback) {

  var ip = logger.ip(req);

  taskListener.openSocket(function opened(error, socket) {

    if (error) {
      callback(error);
      return;
    }

    socket.onData = function receivedData(data) {

      exports.receivedFloodCheckResponse(req, ip, boardUri, socket, data.flood,
          callback);

      taskListener.freeSocket(socket);

    };

    taskListener.sendToSocket(socket, {
      type : 'floodCheck',
      ip : ip
    });

  });

};

exports.checkForBan = function(req, boardUri, callback) {

  if (bypassMandatory && !req.bypassed) {
    callback(null, null, true);

    return;
  }

  torOps.markAsTor(req, function markedAsTor(error) {

    if (error) {
      console.log(error);
    }

    if (req.isTor) {
      if ((req.bypassed && torAllowed) || torLevel > 1) {
        callback();
      } else {

        callback(torPassAllowed ? null : lang(req.language).errBlockedTor,
            null, torPassAllowed);
      }

    } else {
      exports.checkForFlood(req, boardUri, callback);
    }

  });

};
// } Section 2: Ban check

// Section 3: Lift ban {
exports.getLiftedBanLogMessage = function(ban, userData) {

  var pieces = lang().logBanLift;

  var logMessage = pieces.startPiece.replace('{$login}', userData.login);

  if (ban.ip) {

    if (!ban.boardUri) {
      logMessage += pieces.globalBanPiece;
    } else {
      logMessage += pieces.boardBanPiece.replace('{$board}', ban.boardUri);
    }

    logMessage += pieces.finalPiece.replace('{$ban}', ban._id).replace(
        '{$expiration}', ban.expiration);
  } else {
    logMessage += pieces.unknownPiece.replace('{$ban}', ban._id);
  }

  return logMessage;
};

exports.removeBan = function(ban, userData, callback) {

  bans.deleteOne({
    _id : ban._id
  }, function banRemoved(error) {

    if (error) {
      callback(error);
    } else {

      if (ban.range || ban.asn) {
        callback(null, ban.asn ? 'asn' : 'range', ban.boardUri);
        return;
      }

      // style exception, too simple
      var logMessage = exports.getLiftedBanLogMessage(ban, userData);

      logOps.insertLog({
        user : userData.login,
        global : ban.boardUri ? false : true,
        time : new Date(),
        description : logMessage,
        type : 'banLift',
        boardUri : ban.boardUri
      }, function insertedLog() {

        callback(null, null, ban.boardUri);
      });
      // style exception, too simple

    }

  });

};

exports.checkForBoardBanLiftPermission = function(ban, userData, language,
    callback) {

  boards.findOne({
    boardUri : ban.boardUri
  }, function gotBoard(error, board) {
    if (error) {
      callback(error);
    } else if (!board) {
      callback();
    } else {

      if (common.isInBoardStaff(userData, board, 2)) {
        exports.removeBan(ban, userData, callback);
      } else {
        callback(lang(language).errDeniedBoardBanManagement);
      }
    }
  });

};

exports.liftBan = function(userData, parameters, language, callback) {

  var globalStaff = userData.globalRole < miscOps.getMaxStaffRole();

  var allowedToManageRangeBans = userData.globalRole <= minClearIpRole;

  try {
    parameters.banId = new ObjectID(parameters.banId);
  } catch (error) {
    callback();
    return;
  }

  bans.findOne({
    _id : parameters.banId
  },
      function gotBan(error, ban) {
        if (error) {
          callback(error);
        } else if (!ban) {
          callback();
        } else if (ban.boardUri) {
          exports.checkForBoardBanLiftPermission(ban, userData, language,
              callback);
        } else if (!globalStaff) {
          callback(lang(language).errDeniedGlobalBanManagement);
        } else if (ban.range && !allowedToManageRangeBans) {
          callback(lang(language).errDeniedGlobalRangeBanManagement);
        } else {
          exports.removeBan(ban, userData, callback);
        }
      });

};
// } Section 3: Lift ban
