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
var files = db.files();
var logs = db.logs();
var posts = db.posts();
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
var miscDelOps;
var onlyConfirmed;
var sfwOverboard;
var globalBoardModeration;
var boardCreationRequirement;
var maxVolunteers;
var volunteerSettings;
var useLanguages;
var lowercase;

exports.validProtocols = [ 'http', 'https', 'ftp' ];

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
  miscDelOps = require('../deletionOps').miscDeletions;

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

        var protocol = matchesArray[2].match(/(.+):/) || '';
        var invalidProtocol = exports.validProtocols.indexOf(protocol[1]) < 0;

        var refusedProtocol = !protocol || invalidProtocol;

        if (refusedProtocol && matchesArray[2].indexOf('/') !== 0) {
          return '';
        }

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
    ipSalt : crypto.createHash('sha256').update(crypto.randomBytes(256))
        .digest('hex'),
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
exports.getTrashBinCount = function(boardData, foundLanguages,
    appealedBanCount, reportCount, callback) {

  threads.aggregate([ {
    $match : {
      trash : true,
      boardUri : boardData.boardUri
    }
  }, {
    $group : {
      _id : 0,
      threadIds : {
        $push : '$threadId'
      }
    }
  } ]).toArray(
      function(error, results) {

        if (error) {
          return callback(error);
        }

        var trashThreads = results.length ? results[0].threadIds : [];

        // style exception, too simple
        posts.countDocuments({
          boardUri : boardData.boardUri,
          trash : true,
          threadId : {
            $nin : trashThreads
          }
        }, function(error, count) {

          if (error) {
            return callback(error);
          }

          callback(error, boardData, foundLanguages, appealedBanCount,
              reportCount, trashThreads.length + count);

        });
        // style exception, too simple

      });

};

exports.getOpenReportCount = function(boardData, foundLanguages,
    appealedBanCount, callback) {

  reports.countDocuments(reportOps.getQueryBlock({
    boardUri : boardData.boardUri
  }), function(error, count) {

    if (error) {
      return callback(error);
    }

    exports.getTrashBinCount(boardData, foundLanguages, appealedBanCount,
        count, callback);

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
    trash : {
      $ne : true
    },
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

// Section 7: Change board Uri {
exports.migrateFiles = function(parameters, threadRevertOps, postRevertOps,
    callback) {

  files.find({
    'metadata.boardUri' : parameters.boardUri
  }, {
    projection : {
      filename : 1
    }
  }).toArray(
      function(error, foundFiles) {

        if (error) {
          return exports.revertLogs(parameters, threadRevertOps, postRevertOps,
              callback, error);
        }

        var fileOps = [ {
          updateMany : {
            filter : {
              'metadata.boardUri' : parameters.boardUri
            },
            update : {
              $set : {
                'metadata.boardUri' : parameters.newUri
              }
            }
          }
        } ];

        for (var i = 0; i < foundFiles.length; i++) {

          var file = foundFiles[i];

          if (file.filename.indexOf('/' + parameters.boardUri + '/') !== 0) {
            continue;
          }

          var oldPath = '/' + parameters.boardUri + '/';
          var newPath = '/' + parameters.newUri + '/';

          fileOps.push({
            updateOne : {
              filter : {
                _id : file._id
              },
              update : {
                $set : {
                  filename : file.filename.replace(oldPath, newPath)
                }
              }
            }
          });

        }

        // style exception, too simple
        files.bulkWrite(fileOps, function(error) {

          if (error) {
            return exports.revertLogs(parameters, threadRevertOps,
                postRevertOps, callback, error);
          }

          process.send({
            board : parameters.boardUri,
            buildAll : true
          });

          process.send({
            board : parameters.boardUri,
            multiboard : true
          });

          process.send({
            frontPage : true
          });

          if (overboard || sfwOverboard) {
            overboardOps.reaggregate({
              overboard : true,
              reaggregate : true
            });
          }

          callback();

        });
        // style exception, too simple

      });

};

exports.migrateLogs = function(parameters, threadRevertOps, postRevertOps,
    callback) {

  logs.updateMany({
    boardUri : parameters.boardUri
  }, {
    $set : {
      boardUri : parameters.newUri
    },
    $unset : {
      cache : 1,
      alternativeCaches : 1
    }
  }, function(error) {

    if (error) {
      return exports.revertMiscCollections(parameters, threadRevertOps,
          postRevertOps, callback, error);
    }

    exports.migrateFiles(parameters, threadRevertOps, postRevertOps, callback);

  });

};

exports.migrateMiscCollections = function(parameters, threadRevertOps,
    postRevertOps, callback, index) {

  index = index || 0;

  if (index >= miscDelOps.collectionsToClean.length) {
    return exports.migrateLogs(parameters, threadRevertOps, postRevertOps,
        callback);
  }

  miscDelOps.collectionsToClean[index].updateMany({
    boardUri : parameters.boardUri
  }, {
    $set : {
      boardUri : parameters.newUri
    }
  }, function(error) {

    if (error) {
      exports.revertMiscCollections(parameters, threadRevertOps, postRevertOps,
          callback, error);
    } else {
      exports.migrateMiscCollections(parameters, threadRevertOps,
          postRevertOps, callback, ++index);
    }

  });

};

exports.markdownReplace = function(markdown, parameters) {

  var regex = '<a class="quoteLink" href="\/' + parameters.boardUri;

  return markdown.replace(new RegExp(regex, 'g'), function(match) {

    return '<a class="quoteLink" href="/' + parameters.newUri;

  });

};

exports.buildMarkdownReplaceOps = function(postings, ops, reverseOps,
    parameters) {

  for (var i = 0; i < postings.length; i++) {

    var posting = postings[i];

    ops.push({
      updateOne : {
        filter : {
          _id : posting._id
        },
        update : {
          $unset : miscOps.individualCaches,
          $set : {
            markdown : exports.markdownReplace(posting.markdown, parameters),
            boardUri : parameters.newUri
          }
        }
      }
    });

    reverseOps.push({
      updateOne : {
        filter : {
          _id : posting._id
        },
        update : {
          $set : {
            markdown : posting.markdown,
            boardUri : parameters.boardUri
          }
        }
      }
    });

  }

};

exports.migrateAllReplies = function(parameters, threadRevertOps, callback) {

  posts.find({
    boardUri : parameters.boardUri
  }, {
    projection : {
      markdown : 1
    }
  }).toArray(
      function(error, foundPosts) {

        if (error) {
          return exports.revertThreads(threadRevertOps, parameters, error,
              callback);
        } else if (!foundPosts.length) {
          return exports.migrateMiscCollections(parameters, threadRevertOps,
              [], callback);
        }

        var postOps = [];
        var postReverseOps = [];

        exports.buildMarkdownReplaceOps(foundPosts, postOps, postReverseOps,
            parameters);

        // style exception, too simple
        posts.bulkWrite(postOps,
            function(error) {

              if (error) {
                exports.revertThreads(threadRevertOps, parameters, error,
                    callback);
              } else {

                exports.migrateMiscCollections(parameters, threadRevertOps,
                    postReverseOps, callback);
              }

            });
        // style exception, too simple

      });

};

exports.migrateAllThreads = function(parameters, callback) {

  threads.find({
    boardUri : parameters.boardUri
  }, {
    projection : {
      markdown : 1
    }
  }).toArray(
      function(error, foundThreads) {

        if (error) {
          return exports.revertUsersChange(parameters, error, callback);
        } else if (!foundThreads.length) {
          return exports.migrateMiscCollections(parameters, [], [], callback);
        }

        var threadOps = [];
        var threadReverseOps = [];

        exports.buildMarkdownReplaceOps(foundThreads, threadOps,
            threadReverseOps, parameters);

        // style exception, too simple
        threads.bulkWrite(threadOps, function(error) {

          if (error) {
            exports.revertUsersChange(parameters, error, callback);
          } else {
            exports.migrateAllReplies(parameters, threadReverseOps, callback);
          }

        });
        // style exception, too simple

      });

};

exports.revertBoardUriChange = function(parameters, error, callback) {

  boards.updateOne({
    boardUri : parameters.newUri
  }, {
    $set : {
      boardUri : parameters.boardUri
    }
  }, function(newError) {
    callback(newError || error);
  });

};

exports.revertUsersChange = function(parameters, error, callback) {

  users.bulkWrite([ {
    updateOne : {
      filter : {
        ownedBoards : parameters.newUri
      },
      update : {
        $set : {
          'ownedBoards.$' : parameters.boardUri
        }
      }
    }
  }, {
    updateMany : {
      filter : {
        volunteeredBoards : parameters.newUri
      },
      update : {
        $set : {
          'volunteeredBoards.$' : parameters.boardUri
        }
      }
    }
  } ], function(newError) {

    if (newError) {
      console.log(newError);
    }

    exports.revertBoardUriChange(parameters, error, callback);

  });

};

exports.revertThreads = function(threadRevertOps, parameters, error, callback) {

  threads.bulkWrite(threadRevertOps, function(newError) {

    if (newError) {
      console.log(newError);
    }

    exports.revertUsersChange(parameters, error, callback);

  });

};

exports.revertReplies = function(postRevertOps, threadRevertOps, parameters,
    error, callback) {

  posts.bulkWrite(postRevertOps, function(newError) {

    if (newError) {
      console.log(newError);
    }

    exports.revertThreads(threadRevertOps, parameters, error, callback);

  });

};

exports.revertMiscCollections = function(parameters, threadRevertOps,
    postRevertOps, callback, error, index) {

  index = index || 0;

  if (index >= miscDelOps.collectionsToClean.length) {
    return exports.revertReplies(postRevertOps, threadRevertOps, parameters,
        error, callback);
  }

  miscDelOps.collectionsToClean[index].updateMany({
    boardUri : parameters.newUri
  }, {
    $set : {
      boardUri : parameters.boardUri
    }
  }, function(newError) {

    if (newError) {
      console.log(newError);
    }

    exports.revertReplies(postRevertOps, threadRevertOps, parameters, error,
        callback);

  });

};

exports.revertLogs = function(parameters, threadRevertOps, postRevertOps,
    callback, error) {

  logs.updateMany({
    boardUri : parameters.newUri
  }, {
    $set : {
      boardUri : parameters.boardUri
    }
  }, function(newError) {

    if (newError) {
      console.log(newError);
    }

    exports.revertMiscCollections(parameters, threadRevertOps, postRevertOps,
        callback, error);

  });

};

exports.startUriChange = function(parameters, language, callback) {

  boards.updateOne({
    boardUri : parameters.boardUri
  }, {
    $set : {
      boardUri : parameters.newUri
    }
  }, function(error) {

    if (error && error.code !== 11000) {
      return callback(error);
    } else if (error) {
      return callback(lang(language).errUriInUse);
    }

    // style exception, too simple
    users.bulkWrite([ {
      updateOne : {
        filter : {
          ownedBoards : parameters.boardUri
        },
        update : {
          $set : {
            'ownedBoards.$' : parameters.newUri
          }
        }
      }
    }, {
      updateMany : {
        filter : {
          volunteeredBoards : parameters.boardUri
        },
        update : {
          $set : {
            'volunteeredBoards.$' : parameters.newUri
          }
        }
      }
    } ], function(error) {

      if (error) {
        exports.revertBoardUriChange(parameters, error, callback);
      } else {
        exports.migrateAllThreads(parameters, callback);
      }

    });
    // style exception, too simple

  });

};

exports.changeBoardUri = function(userData, parameters, language, callback) {

  var admin = userData.globalRole < 2;

  var newUri = parameters.newUri;

  if (!admin) {
    return callback(lang(language).errDeniedBoardMod);
  } else if (!parameters.boardUri) {
    return callback(lang(language).errBoardNotFound);
  } else if (!parameters.newUri || /\W/.test(parameters.newUri)) {
    return callback(lang(language).errInvalidUri);
  } else if (newUri === overboard || newUri === sfwOverboard) {
    return callback(lang(language).errUriInUse);
  }

  boards.findOne({
    boardUri : parameters.boardUri
  }, function(error, foundBoard) {

    if (error) {
      callback(error);
    } else if (!foundBoard) {
      callback(lang(language).errBoardNotFound);
    } else {
      exports.startUriChange(parameters, language, callback);
    }

  });

};
// } Section 7: Change board Uri
