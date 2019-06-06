'use strict';

var db = require('../../../db');
var bans = db.bans();
var boards = db.boards();
var miscOps;
var common;
var logger;
var logOps;
var captchaOps;
var lang;
var generalBanLimit;
var minClearIpRole;

exports.loadSettings = function() {

  var settings = require('../../../settingsHandler').getGeneralSettings();
  minClearIpRole = settings.clearIpMinRole;
  generalBanLimit = settings.maxBoardGeneralBans;

};

exports.loadDependencies = function() {

  captchaOps = require('../../captchaOps');
  logOps = require('../../logOps');
  common = require('..').common;
  logger = require('../../../logger');
  miscOps = require('../../miscOps');
  lang = require('../../langOps').languagePack;

};

// Section 1: Read range bans {
exports.readRangeBans = function(parameters, callback, boardData) {

  var queryBlock = {
    range : {
      $exists : true
    },
    boardUri : parameters.boardUri ? parameters.boardUri : {
      $exists : false
    },
    $or : [ {
      expiration : {
        $gt : new Date()
      }
    }, {
      expiration : null
    } ]
  };

  bans.find(queryBlock, {
    projection : {
      range : 1,
      reason : 1,
      expiration : 1
    }
  }).sort({
    creation : -1
  }).toArray(function gotBans(error, rangeBans) {
    callback(error, rangeBans, boardData);
  });
};

exports.getRangeBans = function(userData, parameters, language, callback) {

  var isOnGlobalStaff = userData.globalRole <= minClearIpRole;

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
        callback(lang(language).errDeniedBoardRangeBanManagement);
      } else {
        exports.readRangeBans(parameters, callback, board);
      }
    });
  } else if (!isOnGlobalStaff) {
    callback(lang(language).errDeniedGlobalRangeBanManagement);
  } else {
    exports.readRangeBans(parameters, callback);
  }

};
// } Section 1: Read range bans

// Section 2: Create range ban {
exports.createRangeBan = function(userData, parameters, language, callback) {

  parameters.range = miscOps.sanitizeIp(parameters.range);

  miscOps.sanitizeStrings(parameters, common.banArguments);

  common.parseExpiration(parameters);

  if (!parameters.range.length) {
    callback(lang(language).errInvalidRange);

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
        reason : parameters.reason,
        expiration : parameters.expiration,
        range : parameters.range,
        appliedBy : userData.login,
      };

      if (parameters.boardUri) {
        rangeBan.boardUri = parameters.boardUri;
      }

      bans.insertOne(rangeBan, function(error) {
        callback(error, rangeBan._id);
      });

    }

  });

};

exports.placeRangeBan = function(userData, parameters, language, cb,
    checkedCount) {

  var isOnGlobalStaff = userData.globalRole <= minClearIpRole;

  if (parameters.boardUri) {

    if (!checkedCount) {

      parameters.boardUri = parameters.boardUri.toString();

      bans.countDocuments({
        boardUri : parameters.boardUri,
        range : {
          $exists : true
        }
      }, function gotCount(error, count) {

        if (error) {
          cb(error);
        } else if (count >= generalBanLimit) {
          cb(lang(language).errGeneralBanLimit);
        } else {
          exports.placeRangeBan(userData, parameters, language, cb, true);
        }

      });

      return;
    }

    boards.findOne({
      boardUri : parameters.boardUri
    }, function gotBoard(error, board) {
      if (error) {
        cb(error);
      } else if (!board) {
        cb(lang(language).errBoardNotFound);
      } else if (!common.isInBoardStaff(userData, board, 2)) {
        cb(lang(language).errDeniedBoardRangeBanManagement);
      } else {
        exports.createRangeBan(userData, parameters, language, cb);
      }
    });
  } else if (!isOnGlobalStaff) {
    cb(lang(language).errDeniedGlobalRangeBanManagement);
  } else {
    exports.createRangeBan(userData, parameters, language, cb);
  }

};
// } Section 2: Create range ban

// Section 3: Read ASN bans {
exports.readASNBans = function(parameters, callback, boardData) {

  var queryBlock = {
    asn : {
      $exists : true
    },
    boardUri : parameters.boardUri ? parameters.boardUri : {
      $exists : false
    },
    $or : [ {
      expiration : {
        $gt : new Date()
      }
    }, {
      expiration : null
    } ]
  };

  bans.find(queryBlock, {
    projection : {
      asn : 1,
      reason : 1,
      expiration : 1
    }
  }).sort({
    creation : -1
  }).toArray(function gotBans(error, asnBans) {
    callback(error, asnBans, boardData);
  });

};

exports.getAsnBans = function(userData, parameters, language, callback) {

  var isOnGlobalStaff = userData.globalRole <= miscOps.getMaxStaffRole();

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
        callback(lang(language).errDeniedBoardASNBanManagement);
      } else {
        exports.readASNBans(parameters, callback, board);
      }
    });
  } else if (!isOnGlobalStaff) {
    callback(lang(language).errDeniedGlobalASNBanManagement);
  } else {
    exports.readASNBans(parameters, callback);
  }

};
// } Section 3: Read ASN bans

// Section 4: Create ASN ban {
exports.createASNBan = function(user, parameters, language, callback) {

  parameters.asn = +parameters.asn;

  if (!parameters.asn) {
    callback(lang(language).errInvalidASN);
    return;
  }

  miscOps.sanitizeStrings(parameters, common.banArguments);

  common.parseExpiration(parameters);

  parameters.boardUri = parameters.boardUri ? parameters.boardUri.toString()
      : null;

  bans.findOne({
    asn : parameters.asn,
    boardUri : parameters.boardUri ? parameters.boardUri : {
      $exists : false
    }
  }, function gotBan(error, ban) {

    if (error) {
      callback(error);
    } else if (ban) {
      callback();
    } else {

      var asnBan = {
        expiration : parameters.expiration,
        reason : parameters.reason,
        asn : parameters.asn,
        appliedBy : user.login,
      };

      if (parameters.boardUri) {
        asnBan.boardUri = parameters.boardUri;
      }

      bans.insertOne(asnBan, function(error) {
        callback(error, asnBan._id);
      });

    }

  });

};

exports.placeAsnBan = function(user, parameters, language, cb, checkedCount) {

  var isOnGlobalStaff = user.globalRole <= miscOps.getMaxStaffRole();

  if (parameters.boardUri) {

    if (!checkedCount) {

      parameters.boardUri = parameters.boardUri.toString();

      bans.countDocuments({
        boardUri : parameters.boardUri,
        asn : {
          $exists : true
        }
      }, function gotCount(error, count) {

        if (error) {
          cb(error);
        } else if (count >= generalBanLimit) {
          cb(lang(language).errGeneralBanLimit);
        } else {
          exports.createASNBan(user, parameters, language, cb, true);
        }

      });

      return;
    }

    boards.findOne({
      boardUri : parameters.boardUri
    }, function gotBoard(error, board) {
      if (error) {
        cb(error);
      } else if (!board) {
        cb(lang(language).errBoardNotFound);
      } else if (!common.isInBoardStaff(user, board, 2)) {
        cb(lang(language).errDeniedBoardASNBanManagement);
      } else {
        exports.createASNBan(user, parameters, language, cb);
      }
    });
  } else if (!isOnGlobalStaff) {
    cb(lang(language).errDeniedGlobalASNBanManagement);
  } else {
    exports.createASNBan(user, parameters, language, cb);
  }

};
// } Section 4: Create ASN ban
