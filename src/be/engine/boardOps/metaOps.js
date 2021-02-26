'use strict';

// handles board operations on the board themselves

var crypto = require('crypto');
var db = require('../../db');
var reports = db.reports();
var bans = db.bans();
var languages = db.languages();
var users = db.users();
var boards = db.boards();
var threads = db.threads();
var captchaOps;
var logOps;
var forcedCaptcha;
var postingOps;
var customOps;
var reportOps;
var miscOps;
var modCommonOps;
var redactedModNames;
var overboardOps;
var hasOverboard;
var lang;
var maxBoardTags;
var allowJs;
var overboard;
var onlyConfirmed;
var sfwOverboard;
var globalBoardModeration;
var boardCreationRequirement;
var maxVolunteers;
var volunteerSettings;
var useLanguages;
var lowercase;

exports.boardManagementProjection = {
  _id : 0,
  tags : 1,
  owner : 1,
  ipSalt : 1,
  settings : 1,
  maxFiles : 1,
  boardUri : 1,
  boardName : 1,
  volunteers : 1,
  lockedUntil : 1,
  captchaMode : 1,
  boardMessage : 1,
  autoSageLimit : 1,
  anonymousName : 1,
  acceptedMimes : 1,
  maxFileSizeMB : 1,
  maxBumpAgeDays : 1,
  maxThreadCount : 1,
  specialSettings : 1,
  locationFlagMode : 1,
  boardDescription : 1,
  usesCustomSpoiler : 1,
  hourlyThreadLimit : 1,
  preferredLanguage : 1,
  autoCaptchaThreshold : 1,
  autoFullCaptchaThreshold : 1
};

var boardFieldsToCheck = [ 'boardName', 'boardMessage', 'boardDescription' ];

exports.defaultSettings = [ 'disableIds' ];

exports.boardParameters = [ {
  field : 'boardUri',
  length : 32
}, {
  field : 'boardName',
  length : 32,
  removeHTML : true
}, {
  field : 'anonymousName',
  length : 32,
  removeHTML : true
}, {
  field : 'boardDescription',
  length : 128,
  removeHTML : true
}, {
  field : 'preferredLanguage',
  length : 24,
  removeHTML : true
}, {
  field : 'boardMessage'
} ];

exports.transferParameters = [ {
  field : 'login',
  length : 16
} ];

exports.validSpecialSettings = [ 'sfw', 'locked', 'allowJs' ];

exports.loadMoreSettings = function(settings) {

  boardCreationRequirement = settings.boardCreationRequirement;
  maxVolunteers = settings.maxBoardVolunteers;
  maxBoardTags = settings.maxBoardTags;
  redactedModNames = settings.redactModNames;
  overboard = settings.overboard;
  allowJs = settings.allowBoardCustomJs;
  lowercase = settings.lowercaseBoardUris;
  sfwOverboard = settings.sfwOverboard;

};

exports.loadSettings = function() {

  var settings = require('../../settingsHandler').getGeneralSettings();
  forcedCaptcha = settings.forceCaptcha;
  onlyConfirmed = settings.requireConfirmationForBoardCreation;
  hasOverboard = settings.overboard || settings.sfwOverboard;
  useLanguages = settings.useAlternativeLanguages;
  volunteerSettings = settings.allowVolunteerSettings;
  globalBoardModeration = settings.allowGlobalBoardModeration;
  exports.loadMoreSettings(settings);

  exports.boardParameters[4].length = settings.boardMessageLength;

};

exports.loadDependencies = function() {

  overboardOps = require('../overboardOps');
  logOps = require('../logOps');
  customOps = require('./customOps');
  reportOps = require('../modOps').report;
  captchaOps = require('../captchaOps');
  postingOps = require('../postingOps').common;
  miscOps = require('../miscOps');
  modCommonOps = require('../modOps').common;
  lang = require('../langOps').languagePack;

};

exports.getValidSettings = function() {
  return [ 'disableIds', 'forceAnonymity', 'allowCode', 'early404', 'unindex',
      'blockDeletion', 'requireThreadFile', 'uniqueFiles', 'uniquePosts',
      'textBoard' ];
};

// Section 1: New settings {
exports.captchaTextOrAnonimityChanged = function(board, params) {

  var oldSettings = board.settings;
  var newSettings = params.settings;

  var captchaChanged = board.captchaMode !== +params.captchaMode;

  var hadLocationOption = board.locationFlagMode === 1;
  var hasLocationOption = +params.locationFlagMode === 1;

  var changedLocationOption = hadLocationOption !== hasLocationOption;

  var hadAnon = oldSettings.indexOf('forceAnonymity') === -1;
  var hasAnon = newSettings.indexOf('forceAnonymity') === -1;

  var anonChanged = hadAnon !== hasAnon;

  var wasText = oldSettings.indexOf('textBoard') === -1;
  var isText = newSettings.indexOf('textBoard') === -1;

  var textChanged = wasText !== isText;

  var toReturn = changedLocationOption || textChanged || anonChanged;

  return toReturn || (captchaChanged && !forcedCaptcha);

};

exports.fieldsChanged = function(board, params) {

  for (var i = 0; i < boardFieldsToCheck.length; i++) {
    var field = boardFieldsToCheck[i];

    if (board[field] || params[field]) {
      if (board[field] !== params[field]) {
        return true;
      }
    }
  }

  return false;
};

exports.checkBoardRebuild = function(board, params) {

  var didFieldsChanged = exports.fieldsChanged(board, params);

  var settingsChanged = exports.captchaTextOrAnonimityChanged(board, params);

  var mimesChanged = miscOps.arraysDiff(board.acceptedMimes,
      params.acceptedMimes);

  settingsChanged = settingsChanged || mimesChanged;

  var fileLimitsChanged = +board.maxFiles !== +params.maxFiles;

  if (!fileLimitsChanged) {
    fileLimitsChanged = +board.maxFileSizeMB !== +params.maxFileSizeMB;
  }

  if (didFieldsChanged || settingsChanged || fileLimitsChanged) {

    process.send({
      board : params.boardUri,
      buildAll : true
    });

  }

  if (board.boardName !== params.boardName) {
    process.send({
      frontPage : true
    });
  }

};

exports.getMessageMarkdown = function(message) {

  if (!message) {
    return null;
  }

  var ret = miscOps.cleanHTML(message).replace(/\[.+?\]\(.+?\)/g,
      function prettyLinks(match) {
        var matchesArray = match.match(/\[(.+)\]\((.+)\)/);

        return '<a href="' + matchesArray[2] + '">' + matchesArray[1] + '</a>';
      });

  ret = postingOps.replaceStyleMarkdown(ret, false, true);

  return ret;

};

exports.setUpdateForFullAutoCaptcha = function(parameters, newSettings,
    updateBlock, board) {

  var informedAutoFullCaptcha = +parameters.autoFullCaptchaLimit;

  var isInfnity = informedAutoFullCaptcha === Infinity;

  informedAutoFullCaptcha = informedAutoFullCaptcha && !isInfnity;

  if (informedAutoFullCaptcha) {
    newSettings.autoFullCaptchaThreshold = +parameters.autoFullCaptchaLimit;
  } else if (board.autoFullCaptchaThreshold) {
    if (!updateBlock.$unset) {
      updateBlock.$unset = {};
    }

    updateBlock.$unset.autoFullCaptchaCount = 1;
    updateBlock.$unset.autoFullCaptchaStartTime = 1;
    updateBlock.$unset.autoFullCaptchaThreshold = 1;
  }

};

exports.setUpdateForAutoCaptcha = function(parameters, newSettings,
    updateBlock, board) {

  var informedAutoCaptcha = +parameters.autoCaptchaLimit;

  informedAutoCaptcha = informedAutoCaptcha && informedAutoCaptcha !== Infinity;

  if (informedAutoCaptcha) {
    newSettings.autoCaptchaThreshold = +parameters.autoCaptchaLimit;
  } else if (board.autoCaptchaThreshold) {
    if (!updateBlock.$unset) {
      updateBlock.$unset = {};
    }

    updateBlock.$unset.autoCaptchaCount = 1;
    updateBlock.$unset.autoCaptchaStartTime = 1;
    updateBlock.$unset.autoCaptchaThreshold = 1;

  }

  exports.setUpdateForFullAutoCaptcha(parameters, newSettings, updateBlock,
      board);

};

exports.sanitizeBoardTags = function(tags) {

  if (!tags || !tags.length) {
    return [];
  }

  var toRet = [];

  for (var i = 0; i < tags.length && toRet.length < maxBoardTags; i++) {
    var tagToAdd = miscOps.cleanHTML(tags[i].toString()).toLowerCase()
        .substring(0, 32);

    if (tagToAdd.length && toRet.indexOf(tagToAdd) === -1) {
      toRet.push(tagToAdd);
    }
  }

  return toRet;
};

exports.sanitizeBoardMimes = function(mimes) {

  if (!mimes || !mimes.length) {
    return null;
  }

  var toRet = [];

  for (var i = 0; i < mimes.length; i++) {
    var mimeToAdd = mimes[i].toString().trim().toLowerCase();

    if (toRet.indexOf(mimeToAdd) < 0) {
      toRet.push(mimeToAdd);
    }
  }

  return toRet.length ? toRet : null;

};

exports.saveNewSettings = function(board, parameters, callback) {

  parameters.acceptedMimes = exports
      .sanitizeBoardMimes(parameters.acceptedMimes);

  var newSettings = {
    boardName : parameters.boardName,
    boardDescription : parameters.boardDescription,
    settings : parameters.settings,
    preferredLanguage : parameters.preferredLanguage,
    boardMessage : parameters.boardMessage,
    boardMarkdown : exports.getMessageMarkdown(parameters.boardMessage),
    anonymousName : parameters.anonymousName || '',
    tags : exports.sanitizeBoardTags(parameters.tags),
    acceptedMimes : parameters.acceptedMimes,
    autoSageLimit : +parameters.autoSageLimit,
    maxThreadCount : +parameters.maxThreadCount,
    maxFileSizeMB : +parameters.maxFileSizeMB,
    maxBumpAgeDays : +parameters.maxBumpAge,
    maxFiles : +parameters.maxFiles,
    captchaMode : +parameters.captchaMode,
    locationFlagMode : +parameters.locationFlagMode
  };

  var updateBlock = {
    $set : newSettings
  };

  var informedHourlyLimit = +parameters.hourlyThreadLimit;

  informedHourlyLimit = informedHourlyLimit && informedHourlyLimit !== Infinity;

  if (informedHourlyLimit) {
    newSettings.hourlyThreadLimit = +parameters.hourlyThreadLimit;
  } else if (board.hourlyThreadLimit) {
    updateBlock.$unset = {
      lockedUntil : 1,
      threadLockCount : 1,
      lockCountStart : 1,
      hourlyThreadLimit : 1
    };
  }

  exports.setUpdateForAutoCaptcha(parameters, newSettings, updateBlock, board);

  boards.updateOne({
    boardUri : parameters.boardUri
  }, updateBlock, function updatedBoard(error) {

    exports.checkBoardRebuild(board, parameters);

    callback(error);

  });

};

exports.setSettings = function(userData, parameters, language, callback) {

  boards.findOne({
    boardUri : parameters.boardUri
  }, function(error, board) {

    if (error) {
      return callback(error);
    } else if (!board) {
      return callback(lang(language).errBoardNotFound);
    }

    var globallyAllowed = globalBoardModeration && userData.globalRole <= 1;

    var allowed = userData.login === board.owner || globallyAllowed;

    var isVolunteer = (board.volunteers || []).indexOf(userData.login) > -1;

    var globalVolunteer = userData.globalRole <= 2 && globalBoardModeration;
    isVolunteer = isVolunteer || globalVolunteer;

    if (!allowed && !(isVolunteer && volunteerSettings)) {
      callback(lang(language).errDeniedChangeBoardSettings);
    } else {
      miscOps.sanitizeStrings(parameters, exports.boardParameters);

      exports.saveNewSettings(board, parameters, callback);

    }

  });

};
// } Section 1: New settings

// Section 2: Transfer {
exports.updateUsersOwnedBoards = function(oldOwner, parameters, callback) {

  users.updateOne({
    login : oldOwner
  }, {
    $pull : {
      ownedBoards : parameters.boardUri
    }
  }, function removedFromPreviousOwner(error) {

    if (error) {
      callback(error);
    } else {

      users.updateOne({
        login : parameters.login
      }, {
        $addToSet : {
          ownedBoards : parameters.boardUri
        },
        $pull : {
          volunteeredBoards : parameters.boardUri
        }
      }, callback);

    }
  });

};

exports.logTransfer = function(userData, parameters, oldOwner, callback) {

  var message = lang().logTransferBoard.replace('{$actor}',
      redactedModNames ? lang().guiRedactedName : userData.login).replace(
      '{$board}', parameters.boardUri).replace('{$login}',
      redactedModNames ? lang().guiRedactedName : parameters.login);

  logOps.insertLog({
    user : userData.login,
    time : new Date(),
    global : true,
    boardUri : parameters.boardUri,
    type : 'boardTransfer',
    description : message
  }, function createdLog() {
    exports.updateUsersOwnedBoards(oldOwner, parameters, callback);
  });

};

exports.performTransfer = function(oldOwner, userData, newOwnerData,
    parameters, callback) {

  boards.updateOne({
    boardUri : parameters.boardUri
  }, {
    $set : {
      owner : parameters.login,
      inactive : newOwnerData.inactive
    },
    $pull : {
      volunteers : parameters.login
    }
  }, function transferedBoard(error) {
    if (error) {
      callback(error);
    } else if (oldOwner !== userData.login) {
      exports.logTransfer(userData, parameters, oldOwner, callback);
    } else {
      exports.updateUsersOwnedBoards(oldOwner, parameters, callback);
    }

  });

};

exports.transfer = function(userData, parameters, language, callback) {

  var admin = userData.globalRole < 2;

  parameters.boardUri = parameters.boardUri.toString();

  boards.findOne({
    boardUri : parameters.boardUri
  }, {
    projection : {
      _id : 0,
      owner : 1
    }
  }, function gotBoard(error, board) {
    if (error) {
      callback(error);
    } else if (!board) {
      callback(lang(language).errBoardNotFound);
    } else if (userData.login !== board.owner && !admin) {
      callback(lang(language).errDeniedBoardTransfer);
    } else if (board.owner === parameters.login) {
      callback();
    } else {

      miscOps.sanitizeStrings(parameters, exports.transferParameters);

      // style exception, too simple
      users.findOne({
        login : parameters.login
      }, function gotUser(error, user) {
        if (error) {
          callback(error);
        } else if (!user) {
          callback(lang(language).errUserNotFound);
        } else {
          exports.performTransfer(board.owner, userData, user, parameters,
              callback);
        }
      });
      // style exception, too simple

    }

  });

};
// } Section 2: Transfer

// Section 3: Volunteer management {
exports.manageVolunteer = function(currentVolunteers, parameters, language,
    callback) {

  var isAVolunteer = currentVolunteers.indexOf(parameters.login) > -1;

  if (parameters.add === isAVolunteer) {
    callback();
  } else if (!isAVolunteer && currentVolunteers.length >= maxVolunteers) {
    callback(lang(language).errMaxBoardVolunteers);
  } else {

    var operation;
    var userOperation;

    if (isAVolunteer) {
      operation = {
        $pull : {
          volunteers : parameters.login
        }
      };

      userOperation = {
        $pull : {
          volunteeredBoards : parameters.boardUri
        }
      };

    } else {
      operation = {
        $addToSet : {
          volunteers : parameters.login
        }
      };

      userOperation = {
        $addToSet : {
          volunteeredBoards : parameters.boardUri
        }
      };

    }

    users.findOneAndUpdate({
      login : parameters.login
    }, userOperation, function gotUser(error, result) {
      if (error) {
        callback(error);
      } else if (!result.value && !isAVolunteer) {
        callback(lang(language).errUserNotFound);
      } else {

        boards.updateOne({
          boardUri : parameters.boardUri
        }, operation, callback);

      }
    });

  }

};

exports.setVolunteer = function(userData, parameters, language, callback) {

  var globallyAllowed = userData.globalRole <= 1 && globalBoardModeration;

  parameters.add = !!parameters.add;

  parameters.boardUri = parameters.boardUri.toString();

  boards.findOne({
    boardUri : parameters.boardUri
  }, {
    projection : {
      _id : 0,
      owner : 1,
      volunteers : 1
    }
  }, function gotBoard(error, board) {
    if (error) {
      callback(error);
    } else if (!board) {
      callback(lang(language).errBoardNotFound);
    } else if (board.owner !== userData.login && !globallyAllowed) {
      callback(lang(language).errDeniedSetVolunteer);
    } else if (parameters.login === board.owner) {
      callback(lang(language).errOwnerVolunteer);
    } else {
      exports.manageVolunteer(board.volunteers || [], parameters, language,
          callback);
    }
  });

};
// } Section 3: Volunteer management

// Section 4: Creation {
exports.insertBoard = function(parameters, userData, language, callback) {

  boards.insertOne({
    boardUri : parameters.boardUri,
    boardName : parameters.boardName,
    ipSalt : crypto.createHash('sha256').update(
        parameters.toString() + Math.random() + new Date()).digest('hex'),
    boardDescription : parameters.boardDescription,
    owner : userData.login,
    settings : exports.defaultSettings,
    uniqueIps : 0,
    lastPostId : 0,
    captchaMode : 0,
    postsPerHour : 0
  }, function insertedBoard(error) {
    if (error && error.code !== 11000) {
      callback(error);
    } else if (error) {
      callback(lang(language).errUriInUse);
    } else {

      users.updateOne({
        login : userData.login
      }, {
        $addToSet : {
          ownedBoards : parameters.boardUri
        }
      }, callback);

    }
  });

};

exports.createBoard = function(captchaId, parameters, userData, language,
    callback) {

  var allowed = userData.globalRole <= boardCreationRequirement;

  if (!allowed && boardCreationRequirement <= miscOps.getMaxStaffRole()) {
    return callback(lang(language).errDeniedBoardCreation);
  } else if (onlyConfirmed && !userData.confirmed) {
    return callback(lang(language).errOnlyConfirmedEmail);
  }

  miscOps.sanitizeStrings(parameters, exports.boardParameters);

  if (lowercase) {
    parameters.boardUri = parameters.boardUri.toLowerCase();
  }

  var reservedUris = [ overboard, sfwOverboard ];

  if (/\W/.test(parameters.boardUri)) {
    return callback(lang(language).errInvalidUri);
  } else if (reservedUris.indexOf(parameters.boardUri) > -1) {
    return callback(lang(language).errUriInUse);
  }

  captchaOps.attemptCaptcha(captchaId, parameters.captcha, null, language,
      function solvedCaptcha(error) {

        if (error) {
          callback(error);
        } else {
          exports.insertBoard(parameters, userData, language, callback);
        }

      });

};
// } Section 4: Creation

// Section 5: Board management {
exports.getOpenReportCount = function(boardData, foundLanguages,
    appealedBanCount, callback) {

  reports.countDocuments(reportOps.getQueryBlock({
    boardUri : boardData.boardUri
  }), function(error, count) {
    callback(error, boardData, foundLanguages, appealedBanCount, count);
  });

};

exports.getAvailableLanguages = function(boardData, appealedCount, callback) {

  if (!useLanguages) {
    return exports.getOpenReportCount(boardData, [], appealedCount, callback);
  }

  languages.find({}, {
    projection : {
      headerValues : 1
    }
  }).toArray(function(error, foundLanguages) {

    if (error) {
      return callback(error);
    }

    exports.getOpenReportCount(boardData, foundLanguages.map(function(element) {
      return {
        id : element._id.toString(),
        label : element.headerValues.join(', ')
      };
    }), appealedCount, callback);

  });

};

exports.getAppealedBans = function(boardData, callback) {

  bans.countDocuments({
    boardUri : boardData.boardUri,
    appeal : {
      $exists : true
    },
    denied : {
      $exists : false
    }
  }, {
    projection : {
      reason : 1,
      appeal : 1,
      denied : 1,
      expiration : 1,
      appliedBy : 1
    }
  }, function gotBans(error, appealedBanCount) {

    if (error) {
      callback(error);
    } else {
      exports.getAvailableLanguages(boardData, appealedBanCount, callback);
    }

  });

};

exports.getBoardManagementData = function(userData, board,
    associateReportContent, language, callback) {

  boards.findOne({
    boardUri : board
  }, {
    projection : exports.boardManagementProjection
  }, function(error, boardData) {
    if (error) {
      callback(error);
    } else if (!boardData) {
      callback(lang(language).errBoardNotFound);
    } else if (modCommonOps.isInBoardStaff(userData, boardData)) {
      exports.getAppealedBans(boardData, callback);
    } else {
      callback(lang(language).errDeniedManageBoard);
    }
  });

};
// } Section 5: Board management

exports.getBoardModerationData = function(userData, boardUri, language,
    callback) {

  var admin = userData.globalRole < 2;

  if (!admin) {
    callback(lang(language).errDeniedBoardMod);
    return;
  }

  boards.findOne({
    boardUri : boardUri
  }, function gotBoard(error, board) {
    if (error) {
      callback(error);
    } else if (!board) {
      callback(lang(language).errBoardNotFound);
    } else {

      // style exception, too simple
      users.findOne({
        login : board.owner
      }, function gotOwner(error, user) {
        callback(error, board, user);
      });
      // style exception, too simple
    }
  });
};

// Section 6: New special settings {
exports.jsPostSpecial = function(boardData, cb) {

  cb();

  if (!boardData.usesCustomJs || allowJs) {
    return;
  }

  boards.updateOne({
    boardUri : boardData.boardUri
  }, {
    $set : {
      usesCustomJs : false
    }
  }, function(error) {

    if (error) {
      console.log(error);
    } else {
      customOps.removeAllCustomJs([ boardData.boardUri ]);
    }

  });

};

exports.sfwPostSpecial = function(boardData, parameters, cb) {

  var oldSFW = (boardData.specialSettings || []).indexOf('sfw') > -1;
  var newSfw = parameters.specialSettings.indexOf('sfw') > -1;

  if (oldSFW === newSfw) {
    return exports.jsPostSpecial(boardData, cb);
  }

  // style exception, too simple
  threads.updateMany({
    boardUri : parameters.boardUri
  }, {
    $set : {
      sfw : newSfw
    }
  }, function(error) {

    if (error) {
      cb(error);
    }

    if (hasOverboard) {

      overboardOps.reaggregate({
        overboard : true,
        reaggregate : true
      });
    }

    exports.jsPostSpecial(boardData, cb);

  });
  // style exception, too simple

};

exports.setSpecialSettings = function(userData, parameters, language, cb) {

  var admin = userData.globalRole < 2;

  if (!admin) {
    return cb(lang(language).errDeniedBoardMod);
  }

  boards.findOneAndUpdate({
    boardUri : parameters.boardUri
  }, {
    $set : {
      specialSettings : parameters.specialSettings
    }
  }, function gotBoard(error, result) {

    if (error) {
      return cb(error);
    } else if (!result.value) {
      return cb(lang(language).errBoardNotFound);
    }

    exports.sfwPostSpecial(result.value, parameters, cb);

  });

};
// } Section 6: New special settings

exports.aggregateThreadCount = function(boardUri, callback) {

  threads.countDocuments({
    boardUri : boardUri,
    archived : {
      $ne : true
    }
  }, function gotCount(error, count) {

    if (error) {
      callback(error);
    } else {

      boards.updateOne({
        boardUri : boardUri
      }, {
        $set : {
          threadCount : count
        }
      }, callback);

    }

  });

};

exports.unlockAutoLock = function(userData, params, language, callback) {

  boards.findOne({
    boardUri : params.boardUri
  }, function gotBoard(error, boardData) {

    if (error) {
      return callback(error);
    } else if (!boardData) {
      return callback(lang(language).errBoardNotFound);
    } else if (!modCommonOps.isInBoardStaff(userData, boardData, 2)) {
      return callback(lang(language).errDeniedChangeBoardSettings);
    }

    boards.updateOne({
      boardUri : params.boardUri
    }, {
      $unset : {
        lockedUntil : 1,
        threadLockCount : 1,
        lockCountStart : 1
      }
    }, callback);

  });

};
