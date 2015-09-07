'use strict';

var crypto = require('crypto');
var boardFieldsToCheck = [ 'boardName', 'boardMessage', 'boardDescription' ];
var logger = require('../../logger');
var settings = require('../../boot').getGeneralSettings();
var db = require('../../db');
var reports = db.reports();
var users = db.users();
var logs = db.logs();
var boards = db.boards();
var gridFsHandler;
var captchaOps;
var postingOps;
var miscOps;
var modCommonOps;
var lang;

var globalBoardModeration = settings.allowGlobalBoardModeration;

var boardCreationRequirement = settings.boardCreationRequirement;

var maxVolunteers = settings.maxBoardVolunteers;

var defaultSettings = [ 'disableIds', 'disableCaptcha' ];

var boardParameters = [ {
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
  field : 'boardMessage',
  length : 256
} ];

exports.loadDependencies = function() {

  gridFsHandler = require('../gridFsHandler');
  captchaOps = require('../captchaOps');
  postingOps = require('../postingOps').common;
  miscOps = require('../miscOps');
  modCommonOps = require('../modOps').common;
  lang = require('../langOps').languagePack();

};

exports.getValidSettings = function() {
  return [ 'disableIds', 'disableCaptcha', 'forceAnonymity', 'allowCode',
      'archive', 'early404', 'unindex' ];
};

// Section 1: Settings {
function captchaOrAnonimityChanged(board, params) {

  var oldSettings = board.settings;
  var newSettings = params.settings;

  var hadCaptcha = oldSettings.indexOf('disableCaptcha') === -1;
  var hasCaptcha = newSettings.indexOf('disableCaptcha') === -1;

  var captchaChanged = hadCaptcha !== hasCaptcha;

  var hadAnon = oldSettings.indexOf('forceAnonymity') === -1;
  var hasAnon = newSettings.indexOf('forceAnonymity') === -1;

  var anonChanged = hadAnon !== hasAnon;

  return anonChanged || captchaChanged;

}

function fieldsChanged(board, params) {

  for (var i = 0; i < boardFieldsToCheck.length; i++) {
    var field = boardFieldsToCheck[i];

    if (board[field] || params[field]) {
      if (board[field] !== params[field]) {
        return true;
      }
    }
  }

  return false;
}

function checkBoardRebuild(board, params) {

  var didFieldsChanged = fieldsChanged(board, params);

  var settingsChanged = captchaOrAnonimityChanged(board, params);

  if (didFieldsChanged || settingsChanged) {

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

}

function getMessageMarkdown(message) {
  if (!message) {
    return null;
  }

  var ret = message.replace(/[<>]/g, function replace(match) {
    return miscOps.htmlReplaceTable[match];
  });

  ret = ret.replace(/\[.+\]\(.+\)/g, function prettyLinks(match) {
    var matchesArray = match.match(/\[(.+)\]\((.+)\)/);

    return '<a href=\"' + matchesArray[2] + '\">' + matchesArray[1] + '</a>';
  });

  ret = postingOps.replaceStyleMarkdown(ret);

  return ret;

}

function setUpdateForAutoCaptcha(parameters, newSettings, updateBlock, board) {

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
}

function sanitizeBoardTags(tags) {

  if (!tags || !tags.length) {
    return [];
  }

  var toRet = [];

  var replaceFunction = function replace(match) {
    return miscOps.replaceTable[match];
  };

  var i;

  for (i = 0; i < tags.length && toRet.length < settings.maxBoardTags; i++) {
    var tagToAdd = tags[i].toString().trim().replace(/[<>]/g, replaceFunction)
        .toLowerCase().substring(0, 32);

    if (tagToAdd.length && toRet.indexOf(tagToAdd) === -1) {
      toRet.push(tagToAdd);
    }
  }

  return toRet;
}

function saveNewSettings(board, parameters, callback) {

  var newSettings = {
    boardName : parameters.boardName,
    boardDescription : parameters.boardDescription,
    settings : parameters.settings,
    boardMessage : parameters.boardMessage,
    boardMarkdown : getMessageMarkdown(parameters.boardMessage),
    anonymousName : parameters.anonymousName || '',
    tags : sanitizeBoardTags(parameters.tags)
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

  setUpdateForAutoCaptcha(parameters, newSettings, updateBlock, board);

  boards.updateOne({
    boardUri : parameters.boardUri
  }, updateBlock, function updatedBoard(error) {

    checkBoardRebuild(board, parameters);

    callback(error);

  });

}

exports.setSettings = function(userData, parameters, callback) {

  var globallyAllowed = userData.globalRole <= 1 && globalBoardModeration;

  boards.findOne({
    boardUri : parameters.boardUri
  }, function(error, board) {

    if (error) {
      callback(error);
    } else if (!board) {
      callback(lang.errBoardNotFound);
    } else if (board.owner !== userData.login && !globallyAllowed) {
      callback(lang.errDeniedChangeBoardSettings);
    } else {
      miscOps.sanitizeStrings(parameters, boardParameters);

      saveNewSettings(board, parameters, callback);

    }

  });

};
// } Section 1: Settings

// Section 2: Transfer {
function updateUsersOwnedBoards(oldOwner, parameters, callback) {

  users.update({
    login : oldOwner
  }, {
    $pull : {
      ownedBoards : parameters.boardUri
    }
  }, function removedFromPreviousOwner(error) {
    if (error) {
      callback(error);

    } else {

      // style exception, too simple
      users.update({
        login : parameters.login
      }, {
        $addToSet : {
          ownedBoards : parameters.boardUri
        }
      }, function addedToNewOwner(error) {
        callback(error);
      });
      // style exception, too simple

    }
  });

}

function performTransfer(oldOwner, userData, parameters, callback) {

  var message = lang.logTransferBoard.replace('{$actor}', userData.login)
      .replace('{$board}', parameters.boardUri).replace('{$login}',
          parameters.login);

  logs.insert({
    user : userData.login,
    time : new Date(),
    global : true,
    boardUri : parameters.boardUri,
    type : 'boardTransfer',
    description : message
  }, function createdLog(error) {
    if (error) {
      logger.printLogError(message, error);
    }

    // style exception, too simple
    boards.update({
      boardUri : parameters.boardUri
    }, {
      $set : {
        owner : parameters.login
      },
      $pull : {
        volunteers : parameters.login
      }
    }, function transferedBoard(error) {
      if (error) {
        callback(error);
      } else {
        updateUsersOwnedBoards(oldOwner, parameters, callback);
      }

    });
    // style exception, too simple
  });

}

exports.transfer = function(userData, parameters, callback) {

  var admin = userData.globalRole < 2;

  boards.findOne({
    boardUri : parameters.boardUri
  }, {
    _id : 0,
    owner : 1
  }, function gotBoard(error, board) {
    if (error) {
      callback(error);
    } else if (!board) {
      callback(lang.errBoardNotFound);
    } else if (userData.login !== board.owner && !admin) {
      callback(lang.errDeniedBoardTransfer);
    } else if (board.owner === parameters.login) {
      callback();
    } else {

      // style exception, too simple
      users.count({
        login : parameters.login
      }, function gotCount(error, count) {
        if (error) {
          callback(error);
        } else if (!count) {
          callback(lang.errUserNotFound);
        } else {
          performTransfer(board.owner, userData, parameters, callback);
        }
      });
      // style exception, too simple

    }

  });

};
// } Section 2: Transfer

// Section 3: Volunteer management {
function manageVolunteer(currentVolunteers, parameters, callback) {

  var isAVolunteer = currentVolunteers.indexOf(parameters.login) > -1;

  if (parameters.add === isAVolunteer) {
    callback();
  } else if (!isAVolunteer && currentVolunteers.length >= maxVolunteers) {
    callback(lang.errMaxBoardVolunteers);
  } else {

    var operation;

    if (isAVolunteer) {
      operation = {
        $pull : {
          volunteers : parameters.login
        }
      };
    } else {
      operation = {
        $addToSet : {
          volunteers : parameters.login
        }
      };
    }

    users.count({
      login : parameters.login
    }, function gotCount(error, count) {
      if (error) {
        callback(error);
      } else if (!count && !isAVolunteer) {
        callback(lang.errUserNotFound);
      } else {
        // style exception, too simple
        boards.update({
          boardUri : parameters.boardUri
        }, operation, function updatedVolunteers(error) {
          callback(error);
        });
        // style exception, too simple
      }
    });

  }

}

exports.setVolunteer = function(userData, parameters, callback) {

  var globallyAllowed = userData.globalRole <= 1 && globalBoardModeration;

  boards.findOne({
    boardUri : parameters.boardUri
  }, {
    _id : 0,
    owner : 1,
    volunteers : 1
  }, function gotBoard(error, board) {
    if (error) {
      callback(error);
    } else if (!board) {
      callback(lang.errBoardNotFound);
    } else if (board.owner !== userData.login && !globallyAllowed) {
      callback(lang.errDeniedSetVolunteer);
    } else if (parameters.login === board.owner) {
      callback(lang.errOwnerVolunteer);
    } else {
      manageVolunteer(board.volunteers || [], parameters, callback);
    }
  });

};
// } Section 3: Volunteer management

// Section 4: Custom CSS upload {
function updateBoardAfterNewCss(board, callback) {

  if (!boards.usesCustomCss) {
    boards.updateOne({
      boardUri : board.boardUri
    }, {
      $set : {
        usesCustomCss : true
      }
    }, function updatedBoard(error) {
      if (error) {
        callback(error);
      } else {
        process.send({
          board : board.boardUri,
          buildAll : true
        });

        callback();
      }

    });
  } else {
    callback();
  }

}

exports.setCustomCss = function(userData, boardUri, file, callback) {

  var globallyAllowed = userData.globalRole <= 1 && globalBoardModeration;

  boards.findOne({
    boardUri : boardUri
  }, function gotBoard(error, board) {
    if (error) {
      callback(error);
    } else if (!board) {
      callback(lang.errBoardNotFound);
    } else if (board.owner !== userData.login && !globallyAllowed) {
      callback(lang.errDeniedCssManagement);
    } else if (file.mime !== 'text/css') {
      callback(lang.errOnlyCssAllowed);
    } else {

      // style exception, too simple
      gridFsHandler.writeFile(file.pathInDisk, '/' + boardUri + '/custom.css',
          file.mime, {
            boardUri : boardUri
          }, function savedFile(error) {
            if (error) {
              callback(error);
            } else {
              updateBoardAfterNewCss(board, callback);
            }
          });
      // style exception, too simple

    }
  });

};
// } Section 4: Custom CSS upload

// Section 5: Custom CSS deletion {
function updateBoardAfterDeleteCss(board, callback) {

  if (board.usesCustomCss) {
    boards.updateOne({
      boardUri : board.boardUri
    }, {
      $set : {
        usesCustomCss : false
      }
    }, function updatedBoard(error) {
      if (error) {
        callback(error);
      } else {
        process.send({
          board : board.boardUri,
          buildAll : true
        });
        callback();
      }

    });
  } else {
    callback();
  }

}

exports.deleteCustomCss = function(userData, boardUri, callback) {

  var globallyAllowed = userData.globalRole <= 1 && globalBoardModeration;

  boards.findOne({
    boardUri : boardUri
  }, function gotBoard(error, board) {
    if (error) {
      callback(error);
    } else if (!board) {
      callback(lang.errBoardNotFound);
    } else if (board.owner !== userData.login && !globallyAllowed) {
      callback(lang.errDeniedCssManagement);
    } else {

      // style exception, too simple
      gridFsHandler.removeFiles('/' + boardUri + '/custom.css',
          function removedFile(error) {
            if (error) {
              callback(error);
            } else {
              updateBoardAfterDeleteCss(board, callback);
            }
          });
      // style exception, too simple

    }
  });

};
// } Section 5: Custom CSS deletion

// Section 6: Creation {
function insertBoard(parameters, userData, callback) {

  boards.insert({
    boardUri : parameters.boardUri,
    boardName : parameters.boardName,
    ipSalt : crypto.createHash('sha256').update(
        parameters.toString() + Math.random() + new Date()).digest('hex'),
    boardDescription : parameters.boardDescription,
    owner : userData.login,
    settings : defaultSettings,
  }, function insertedBoard(error) {
    if (error && error.code !== 11000) {
      callback(error);
    } else if (error) {
      callback(lang.errUriInUse);
    } else {

      // style exception, too simple
      users.update({
        login : userData.login
      }, {
        $addToSet : {
          ownedBoards : parameters.boardUri
        }
      }, function updatedUser(error) {
        // signal rebuild of board pages
        process.send({
          board : parameters.boardUri,
          buildAll : true
        });

        callback(error);
      });
      // style exception, too simple

    }
  });

}

exports.createBoard = function(captchaId, parameters, userData, callback) {

  var allowed = userData.globalRole <= boardCreationRequirement;

  if (!allowed && boardCreationRequirement <= miscOps.getMaxStaffRole()) {
    callback(lang.errDeniedBoardCreation);
    return;
  }

  miscOps.sanitizeStrings(parameters, boardParameters);

  if (/\W/.test(parameters.boardUri)) {
    callback(lang.errInvalidUri);
    return;
  }

  captchaOps.attemptCaptcha(captchaId, parameters.captcha, null,
      function solvedCaptcha(error) {

        if (error) {
          callback(error);
        } else {
          insertBoard(parameters, userData, callback);
        }

      });

};
// } Section 6: Creation

exports.setCustomSpoiler = function(userData, boardUri, file, callback) {

  var globallyAllowed = userData.globalRole <= 1 && globalBoardModeration;

  boards.findOne({
    boardUri : boardUri
  }, function gotBoard(error, board) {
    if (error) {
      callback(error);
    } else if (!board) {
      callback(lang.errBoardNotFound);
    } else if (board.owner !== userData.login && !globallyAllowed) {
      callback(lang.errDeniedSpoilerManagement);
    } else if (file.mime.indexOf('image/') === -1) {
      callback(lang.errNotAnImage);
    } else {

      var newPath = '/' + boardUri + '/custom.spoiler';

      // style exception, too simple
      gridFsHandler.writeFile(file.pathInDisk, newPath, file.mime, {
        boardUri : boardUri
      }, function savedFile(error) {

        if (error) {
          callback(error);
        } else if (!boards.usesCustomSpoiler) {
          boards.updateOne({
            boardUri : board.boardUri
          }, {
            $set : {
              usesCustomSpoiler : true
            }
          }, callback);
        } else {
          callback();
        }

      });
      // style exception, too simple

    }
  });
};

exports.deleteCustomSpoiler = function(userData, boardUri, callback) {

  var globallyAllowed = userData.globalRole <= 1 && globalBoardModeration;

  boards.findOne({
    boardUri : boardUri
  }, function gotBoard(error, board) {
    if (error) {
      callback(error);
    } else if (!board) {
      callback(lang.errBoardNotFound);
    } else if (board.owner !== userData.login && !globallyAllowed) {
      callback(lang.errDeniedSpoilerManagement);
    } else {

      // style exception, too simple
      gridFsHandler.removeFiles('/' + boardUri + '/custom.spoiler',
          function removedFile(error) {
            if (error) {
              callback(error);
            } else {
              boards.updateOne({
                boardUri : board.boardUri
              }, {
                $set : {
                  usesCustomSpoiler : false
                }
              }, callback);
            }
          });
      // style exception, too simple

    }
  });

};

// Section 7: Board management {
function getBoardReports(boardData, callback) {

  reports.find({
    boardUri : boardData.boardUri,
    closedBy : {
      $exists : false
    },
    global : false
  }, {
    boardUri : 1,
    threadId : 1,
    creation : 1,
    postId : 1,
    reason : 1
  }).sort({
    creation : -1
  }).toArray(function(error, reports) {

    callback(error, boardData, reports);

  });

}

exports.getBoardManagementData = function(userData, board, callback) {

  boards.findOne({
    boardUri : board
  }, {
    _id : 0,
    tags : 1,
    owner : 1,
    settings : 1,
    boardUri : 1,
    boardName : 1,
    volunteers : 1,
    boardMessage : 1,
    anonymousName : 1,
    boardDescription : 1,
    usesCustomSpoiler : 1,
    hourlyThreadLimit : 1,
    autoCaptchaThreshold : 1
  }, function(error, boardData) {
    if (error) {
      callback(error);
    } else if (!boardData) {
      callback(lang.errBoardNotFound);
    } else if (modCommonOps.isInBoardStaff(userData, boardData)) {
      getBoardReports(boardData, callback);
    } else {
      callback(lang.errDeniedManageBoard);
    }
  });

};
// } Section 7: Board management

exports.getBoardModerationData = function(userData, boardUri, callback) {

  var admin = userData.globalRole < 2;

  if (!admin) {
    callback(lang.errDeniedBoardMod);
    return;
  }

  boards.findOne({
    boardUri : boardUri
  }, function gotBoard(error, board) {
    if (error) {
      callback(error);
    } else if (!board) {
      callback(lang.errBoardNotFound);
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
