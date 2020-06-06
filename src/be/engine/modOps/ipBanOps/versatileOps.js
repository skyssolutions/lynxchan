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
var redactedModNames;
var torOps;
var spamOps;
var verbose;
var common;
var spamBypass;
var globalBoardModeration;
var floodTracking = {};
var threadFloodTracking = {};

exports.loadSettings = function() {
  var settings = require('../../../settingsHandler').getGeneralSettings();

  verbose = settings.verbose || settings.verboseMisc;
  floodTimer = settings.floodTimerSec * 1000;
  minClearIpRole = settings.clearIpMinRole;
  torLevel = settings.torPostingLevel;
  torAllowed = torLevel > 0;
  bypassAllowed = settings.bypassMode > 0;
  torPassAllowed = bypassAllowed && torAllowed;
  redactedModNames = settings.redactModNames;
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

  (task.thread ? threadFloodTracking : floodTracking)[task.ip] = new Date(
      task.expiration);

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

  keys = Object.keys(threadFloodTracking);

  for (i = 0; i < keys.length; i++) {

    key = keys[i];

    if (threadFloodTracking[key] < now) {
      delete threadFloodTracking[key];
    }

  }

};

exports.masterFloodCheck = function(task, socket) {

  var trackingToUse = task.thread ? threadFloodTracking : floodTracking;

  var lastEntry = trackingToUse[task.ip];

  var left;

  var now = new Date();

  var flood = !!(lastEntry && now < lastEntry);

  if (flood) {
    left = Math.ceil((lastEntry.getTime() - now.getTime()) / 1000);
  } else {
    var toAdd = task.record ? (task.thread ? 10 : 1) * floodTimer : 1000;

    trackingToUse[task.ip] = new Date(new Date().getTime() + toAdd);
  }

  taskListener.sendToSocket(socket, {
    flood : flood,
    left : left
  });

};

// Section 1: Bans {
exports.readBans = function(parameters, callback) {

  var queryBlock = {
    $and : [ {
      $or : [ {
        ip : {
          $exists : true
        }
      }, {
        bypassId : {
          $exists : true
        }
      } ]
    }, {
      $or : [ {
        expiration : {
          $gt : new Date()
        }
      }, {
        expiration : null
      } ]
    } ],
    warning : {
      $ne : true
    }
  };

  if (parameters.boardUri) {
    queryBlock.boardUri = parameters.boardUri;
  } else if (!globalBoardModeration) {
    queryBlock.boardUri = null;
  }

  bans.find(queryBlock, {
    projection : {
      reason : 1,
      appeal : 1,
      denied : 1,
      ip : 1,
      bypassId : 1,
      boardUri : 1,
      expiration : 1,
      appliedBy : 1
    }
  }).sort({
    creation : -1
  }).toArray(callback);
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
exports.noMatch = function(ip, foundBan) {

  if (!foundBan.range) {
    return;
  }

  if (ip.length === 4 && foundBan.ipv6 || foundBan.range.length > ip.length) {
    return true;
  }

  for (var i = 0; i < foundBan.range.length; i++) {

    if (foundBan.range[i] !== ip[i]) {
      return true;
    }

  }

};

exports.filterBans = function(ip, bans) {

  var ban;

  for (var i = 0; i < bans.length; i++) {

    var foundBan = bans[i];

    if (ip && exports.noMatch(ip, foundBan)) {
      continue;
    }

    if (!ban || (ban.warning && !foundBan.warning)) {
      ban = foundBan;
      continue;
    }

    var genericBan = ban.asn || ban.range;

    var foundGeneric = foundBan.asn || foundBan.range;

    var genericPriority = foundBan.nonBypassable && !ban.nonBypassable;

    if (genericBan && (!foundGeneric || genericPriority)) {
      ban = foundBan;
    }
  }

  return ban;

};

exports.getActiveBan = function(ip, asn, bypass, boardUri, callback) {

  var matchArray = [];

  if (bypass) {
    matchArray.push({
      bypassId : bypass
    });
  }

  if (ip) {
    matchArray.push({
      ip : ip
    });
  }

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
      $or : matchArray
    }, expirationOr ]
  };

  if (ip) {

    finalCondition.$and[1].$or.push({
      'range.0' : ip[0]
    });

  }

  if (asn) {
    finalCondition.$and[1].$or.push({
      asn : asn
    });
  }

  bans.find(finalCondition).toArray(function gotBans(error, bans) {

    if (error) {
      return callback(error);
    }

    var ban = exports.filterBans(ip, bans);

    var canBypass = bypassAllowed && spamBypass && ban;
    canBypass = canBypass && !ban.nonBypassable;

    callback(null, ban, canBypass && (ban.asn || ban.range));

  });

};

exports.getASN = function(req, boardUri, callback) {

  var ip = logger.ip(req);

  locationOps.getASN(ip, function gotASN(error, asn) {

    if (error && verbose) {
      console.log(error);
    }

    req.asn = asn;

    exports.getActiveBan(ip, asn, req.bypassId, boardUri, callback);

  });

};

exports.receivedFloodCheckResponse = function(req, ip, boardUri, floodData,
    callback) {

  if (floodData.flood && !disableFloodCheck) {
    return callback(lang(req.language).errFlood.replace('{$time}',
        floodData.left));
  }

  spamOps.checkDnsbl(logger.ip(req), function checked(error, spammer) {

    if (error) {
      return callback(error);
    } else if (!spammer) {
      return exports.getASN(req, boardUri, callback);
    }

    if (spamBypass && bypassAllowed) {

      if (!req.bypassed) {
        callback(null, null, true);
      } else {
        exports.getASN(req, boardUri, callback);
      }

    } else {
      callback(lang(req.language).errSpammer);
    }

  });

};

exports.checkForFlood = function(req, boardUri, thread, callback) {

  var ip = logger.ip(req);

  taskListener.openSocket(function opened(error, socket) {

    if (error) {
      callback(error);
      return;
    }

    socket.onData = function receivedData(data) {

      exports.receivedFloodCheckResponse(req, ip, boardUri, data, callback);

      taskListener.freeSocket(socket);

    };

    taskListener.sendToSocket(socket, {
      type : 'floodCheck',
      ip : ip,
      thread : thread
    });

  });

};

exports.checkForBan = function(req, boardUri, thread, callback) {

  if (bypassMandatory && !req.bypassed) {
    return callback(null, null, true);
  }

  torOps.markAsTor(req, function markedAsTor(error) {

    if (error) {
      console.log(error);
    }

    if (!req.isTor) {
      return exports.checkForFlood(req, boardUri, thread, callback);
    }

    if ((req.bypassed && torAllowed) || torLevel > 1) {

      if (req.bypassId) {
        exports.getActiveBan(null, null, req.bypassId, boardUri, callback);
      } else {
        callback();
      }

    } else {

      callback(torPassAllowed ? null : lang(req.language).errBlockedTor, null,
          torPassAllowed);
    }

  });

};
// } Section 2: Ban check

// Section 3: Lift ban {
exports.getLiftedBanLogMessage = function(ban, userData) {

  var pieces = lang().logBanLift;

  var logMessage = pieces.startPiece.replace('{$login}',
      redactedModNames ? lang().guiRedactedName : userData.login);

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

// Section 4: Appealed bans {
exports.readAppealedBans = function(parameters, callback) {

  var queryBlock = {
    appeal : {
      $exists : true
    },
    denied : {
      $exists : false
    }
  };

  if (parameters.boardUri) {
    queryBlock.boardUri = parameters.boardUri;
  } else if (!globalBoardModeration) {
    queryBlock.boardUri = null;
  }

  bans.find(queryBlock, {
    projection : {
      reason : 1,
      appeal : 1,
      asn : 1,
      boardUri : 1,
      ip : 1,
      bypassId : 1,
      range : 1,
      denied : 1,
      expiration : 1,
      appliedBy : 1
    }
  }).sort({
    creation : -1
  }).toArray(callback);
};

exports.getAppealedBans = function(userData, parameters, language, callback) {

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
        exports.readAppealedBans(parameters, callback);
      }
    });
  } else if (!isOnGlobalStaff) {
    callback(lang(language).errDeniedGlobalBanManagement);
  } else {
    exports.readAppealedBans(parameters, callback);
  }

};
// } Section 4: Appealed bans
