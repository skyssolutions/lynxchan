'use strict';

var mongo = require('mongodb');
var ObjectID = mongo.ObjectID;
var db = require('../../../db');
var bans = db.bans();
var proxyBans = db.proxyBans();
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

  logMessage += pieces.finalPiece.replace('{$range}', parameters.range);

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

  var processedRange = miscOps.sanitizeIp(parameters.range);

  if (!processedRange.length) {
    callback(lang.errInvalidRange);

    return;
  }

  bans.findOne({
    range : processedRange,
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
        range : processedRange,
        appliedBy : userData.login,
      };

      if (parameters.boardUri) {
        rangeBan.boardUri = parameters.boardUri;
      }

      // style exception,too simple
      bans.insert(rangeBan, function insertedBan(error) {
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

// Section 3: Proxy ban reading {
exports.readProxyBans = function(parameters, callback) {

  proxyBans.find({
    boardUri : parameters.boardUri || null
  }).toArray(callback);

};

exports.getProxyBans = function(userData, parameters, callback) {

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
        callback(lang.errDeniedBoardProxyBanManagement);
      } else {
        exports.readProxyBans(parameters, callback);
      }
    });
  } else if (!isOnGlobalStaff) {
    callback(lang.errDeniedGlobalProxyBansManagement);
  } else {
    exports.readProxyBans(parameters, callback);
  }

};
// } Section 3: Proxy ban reading

// Section 4: Proxy ban creation {
exports.logProxyBan = function(login, board, ip, callback) {

  var msg = lang.logProxyBan.replace('{$login}', login).replace('{$ip}', ip)
      .replace('{$board}', board || lang.miscAllBoards.toLowerCase());

  logOps.insertLog({
    user : login,
    boardUri : board,
    type : 'proxyBan',
    time : new Date(),
    description : msg,
    global : board ? false : true
  }, callback);

};

exports.createProxyBan = function(userData, parameters, callback) {

  var processedIp = miscOps.sanitizeIp(parameters.proxyIp);

  if (!processedIp.length) {
    callback(lang.errInvalidIp);
    return;
  }

  proxyBans.findOne({
    boardUri : parameters.boardUri || null,
    proxyIp : processedIp
  }, function gotProxy(error, ban) {
    if (error) {
      callback(error);
    } else if (ban) {
      callback();
    } else {

      // style exception, too simple
      proxyBans.insert({
        boardUri : parameters.boardUri || null,
        proxyIp : processedIp
      }, function createdBan(error) {
        if (error) {
          callback(error);
        } else {
          exports.logProxyBan(userData.login, parameters.boardUri, processedIp,
              callback);
        }
      });
      // style exception, too simple

    }
  });
};

exports.checkProxyBanPermission = function(userData, parameters, callback) {

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
        callback(lang.errDeniedBoardProxyBanManagement);
      } else {
        exports.createProxyBan(userData, parameters, callback);
      }
    });
  } else if (!isOnGlobalStaff) {
    callback(lang.errDeniedGlobalProxyBansManagement);
  } else {
    exports.createProxyBan(userData, parameters, callback);
  }

};

exports.placeProxyBan = function(userData, parameters, captchaId, callback) {

  captchaOps.attemptCaptcha(captchaId, parameters.captcha, null,
      function solvedCaptcha(error) {
        if (error) {
          callback(error);
        } else {
          exports.checkProxyBanPermission(userData, parameters, callback);
        }
      });

};
// } Section 4: Proxy ban creation

// Section 5: Proxy ban lift
exports.removeProxyBan = function(userData, ban, callback) {

  proxyBans.deleteOne({
    _id : new ObjectID(ban._id)
  }, function removedBan(error) {

    if (error) {
      callback(error);
    } else {

      var msg = lang.logProxyBanLift.replace('{$login}', userData.login)
          .replace('{$ip}', ban.proxyIp.join('.')).replace('{$board}',
              ban.boardUri || lang.miscAllBoards.toLowerCase());

      // style exception, too simple
      logOps.insertLog({
        type : 'proxyBanLift',
        user : userData.login,
        time : new Date(),
        description : msg,
        global : ban.global,
        boardUri : ban.boardUri
      }, function logged() {

        callback(null, ban.boardUri);

      });
      // style exception, too simple

    }

  });

};

exports.checkForProxyBanLiftPermission = function(userData, ban, callback) {

  boards.findOne({
    boardUri : ban.boardUri
  }, function gotBoard(error, board) {
    if (error) {
      callback(error);
    } else if (!board) {
      callback();
    } else {

      if (common.isInBoardStaff(userData, board, 2)) {
        exports.removeProxyBan(userData, ban, callback);
      } else {
        callback(lang.errDeniedBoardProxyBanManagement);
      }
    }
  });

};

exports.liftProxyBan = function(userData, parameters, callback) {

  var isOnGlobalStaff = userData.globalRole < miscOps.getMaxStaffRole();

  try {

    proxyBans.findOne({
      _id : new ObjectID(parameters.proxyBanId)
    }, function gotBan(error, ban) {

      if (error) {
        callback(error);
      } else if (!ban) {
        callback();
      } else if (!ban.boardUri && !isOnGlobalStaff) {
        callback(lang.errDeniedGlobalProxyBansManagement);
      } else if (!ban.boardUri) {
        exports.removeProxyBan(userData, ban, callback);
      } else {
        exports.checkForProxyBanLiftPermission(userData, ban, callback);
      }

    });

  } catch (error) {
    callback(error);
  }

};
// Section 5: Proxy ban lift

