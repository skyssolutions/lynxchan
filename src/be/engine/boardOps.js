'use strict';

// handles board operations

var mongo = require('mongodb');
var ObjectID = mongo.ObjectID;
var db = require('../db');
var miscOps = require('./miscOps');
var gridFsHandler = require('./gridFsHandler');
var logger = require('../logger');
var files = db.files();
var reports = db.reports();
var lang = require('./langOps').languagePack();
var users = db.users();
var boards = db.boards();
var logs = db.logs();
var settings = require('../boot').getGeneralSettings();
var restrictedBoardCreation = settings.restrictBoardCreation;
var validSettings = [ 'disableIds', 'disableCaptcha', 'forceAnonymity' ];

var boardParameters = [ {
  field : 'boardUri',
  length : 32
}, {
  field : 'boardName',
  length : 32
}, {
  field : 'anonymousName',
  length : 32
}, {
  field : 'boardDescription',
  length : 128
} ];

var filterParameters = [ {
  field : 'originalTerm',
  length : 32
}, {
  field : 'replacementTerm',
  length : 32,
  removeHTML : true
} ];

exports.getValidSettings = function() {
  return validSettings;
};

function checkBoardRebuild(board, params) {

  var nameChanged = board.boardName !== params.boardName;

  var descriptionChanged = board.boardDescription !== params.boardDescription;

  var oldSettings = board.settings;
  var newSettings = params.settings;

  var hadCaptcha = oldSettings.indexOf('disableCaptcha') === -1;
  var hasCaptcha = newSettings.indexOf('disableCaptcha') === -1;

  var captchaChanged = hadCaptcha !== hasCaptcha;

  var hadAnon = oldSettings.indexOf('forceAnonymity') === -1;
  var hasAnon = newSettings.indexOf('forceAnonymity') === -1;

  var anonChanged = hadAnon !== hasAnon;

  if (nameChanged || descriptionChanged || captchaChanged || anonChanged) {

    process.send({
      board : params.boardUri,
      buildAll : true
    });

  }

  if (nameChanged) {
    process.send({
      frontPage : true
    });
  }

}

function saveNewSettings(board, parameters, callback) {

  boards.updateOne({
    boardUri : parameters.boardUri
  }, {
    $set : {
      boardName : parameters.boardName,
      boardDescription : parameters.boardDescription,
      settings : parameters.settings,
      anonymousName : parameters.anonymousName
    }
  }, function updatedBoard(error) {

    checkBoardRebuild(board, parameters);

    callback(error);

  });

}

exports.setSettings = function(userData, parameters, callback) {

  boards.findOne({
    boardUri : parameters.boardUri
  }, function(error, board) {

    if (error) {
      callback(error);
    } else if (!board) {
      callback(lang.errBoardNotFound);
    } else if (board.owner !== userData.login) {
      callback(lang.errDeniedChangeBoardSettings);
    } else {
      miscOps.sanitizeStrings(parameters, boardParameters);

      saveNewSettings(board, parameters, callback);

    }

  });

};

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

function manageVolunteer(currentVolunteers, parameters, callback) {

  var isAVolunteer = currentVolunteers.indexOf(parameters.login) > -1;

  if (parameters.add === isAVolunteer) {
    callback();
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

  if (userData.login === parameters.login) {
    callback(lang.errSelfVolunteer);
    return;
  }

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
    } else if (board.owner !== userData.login) {
      callback(lang.errDeniedSetVolunteer);
    } else {
      manageVolunteer(board.volunteers || [], parameters, callback);
    }
  });

};

function isAllowedToManageBoard(login, boardData) {

  var owner = login === boardData.owner;

  var volunteer;

  if (boardData.volunteers) {
    volunteer = boardData.volunteers.indexOf(login) > -1;
  }

  return owner || volunteer;

}

function getBoardReports(boardData, callback) {

  reports.find({
    boardUri : boardData.boardUri,
    closedBy : {
      $exists : false
    },
    global : false
  }).sort({
    creation : -1
  }).toArray(function(error, reports) {

    callback(error, boardData, reports);

  });

}

exports.getBoardManagementData = function(login, board, callback) {

  boards.findOne({
    boardUri : board
  }, {
    _id : 0,
    owner : 1,
    boardUri : 1,
    boardName : 1,
    anonymousName : 1,
    settings : 1,
    boardDescription : 1,
    volunteers : 1
  }, function(error, boardData) {
    if (error) {
      callback(error);
    } else if (!boardData) {
      callback(lang.errBoardNotFound);
    } else if (isAllowedToManageBoard(login, boardData)) {
      getBoardReports(boardData, callback);
    } else {
      callback(lang.errDeniedManageBoard);
    }
  });

};

exports.createBoard = function(parameters, userData, callback) {

  var role = userData.globalRole || 4;

  if (role > 1 && restrictedBoardCreation) {
    callback(lang.errDeniedBoardCreation);
    return;
  }

  miscOps.sanitizeStrings(parameters, boardParameters);

  if (/\W/.test(parameters.boardUri)) {
    callback(lang.errInvalidUri);
    return;
  }

  boards.insert({
    boardUri : parameters.boardUri,
    boardName : parameters.boardName,
    boardDescription : parameters.boardDescription,
    owner : userData.login,
    settings : []
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
          board : parameters.boardUri
        });

        callback(error);
      });

      // style exception, too simple

    }
  });

};

exports.getBannerData = function(user, boardUri, callback) {

  boards.findOne({
    boardUri : boardUri
  }, function gotBoard(error, board) {
    if (error) {
      callback(error);
    } else if (!board) {
      callback(lang.errBoardNotFound);
    } else if (board.owner !== user) {
      callback(lang.errDeniedChangeBoardSettings);
    } else {

      // style exception, too simple
      files.find({
        'metadata.boardUri' : boardUri,
        'metadata.type' : 'banner'
      }).sort({
        uploadDate : 1
      }).toArray(function(error, banners) {
        callback(error, banners);
      });
      // style exception, too simple
    }
  });

};

exports.addBanner = function(user, parameters, callback) {

  if (!parameters.files.length) {
    callback(lang.errNoFiles);
    return;
  } else if (parameters.files[0].mime.indexOf('image/') === -1) {
    callback(lang.errNotAnImage);
    return;
  }

  boards.findOne({
    boardUri : parameters.boardUri
  }, function gotBoard(error, board) {
    if (error) {
      callback(error);
    } else if (!board) {
      callback(lang.errBoardNotFound);
    } else if (board.owner !== user) {
      callback(lang.errDeniedChangeBoardSettings);
    } else {
      var bannerPath = '/' + parameters.boardUri + '/banners/';
      bannerPath += new Date().getTime();

      var file = parameters.files[0];

      gridFsHandler.writeFile(file.pathInDisk, bannerPath, file.mime, {
        boardUri : parameters.boardUri,
        status : 200,
        type : 'banner'
      }, callback);
    }
  });

};
// start of banner deletion

function removeBanner(banner, callback) {
  gridFsHandler.removeFiles(banner.filename, function removedFile(error) {
    callback(error, banner.metadata.boardUri);
  });

}

exports.deleteBanner = function(login, parameters, callback) {

  try {

    files.findOne({
      _id : new ObjectID(parameters.bannerId)
    }, function gotBanner(error, banner) {
      if (error) {
        callback(error);
      } else if (!banner) {
        callback(lang.errBannerNotFound);
      } else {
        // style exception, too simple

        boards.findOne({
          boardUri : banner.metadata.boardUri
        }, function gotBoard(error, board) {
          if (error) {
            callback(error);
          } else if (!board) {
            callback(lang.errBoardNotFound);
          } else if (board.owner !== login) {
            callback(lang.errDeniedChangeBoardSettings);
          } else {
            removeBanner(banner, callback);
          }
        });
        // style exception, too simple

      }

    });
  } catch (error) {
    callback(error);
  }
};
// end of banner deletion

exports.getFilterData = function(user, boardUri, callback) {

  boards.findOne({
    boardUri : boardUri
  }, function gotBoard(error, board) {
    if (error) {
      callback(error);
    } else if (!board) {
      callback(lang.errBoardNotFound);
    } else if (user !== board.owner) {
      callback(lang.errDeniedChangeBoardSettings);
    } else {
      callback(null, board.filters || []);
    }
  });

};

exports.createFilter = function(user, parameters, callback) {

  miscOps.sanitizeStrings(parameters, filterParameters);

  boards.findOne({
    boardUri : parameters.boardUri
  }, function gotBoard(error, board) {
    if (error) {
      callback(error);
    } else if (!board) {
      callback(lang.errBoardNotFound);
    } else if (board.owner !== user) {
      callback(lang.errDeniedChangeBoardSettings);
    } else {

      var existingFilters = board.filters || [];

      var found = false;

      for (var i = 0; i < existingFilters.length; i++) {
        var filter = existingFilters[i];

        if (filter.originalTerm === parameters.originalTerm) {
          found = true;

          filter.replacementTerm = parameters.replacementTerm;

          break;
        }
      }

      if (!found) {

        existingFilters.push({
          originalTerm : parameters.originalTerm,
          replacementTerm : parameters.replacementTerm
        });

      }

      // style exception, too simple
      boards.updateOne({
        boardUri : parameters.boardUri
      }, {
        $set : {
          filters : existingFilters
        }
      }, function updatedFilters(error) {
        callback(error);
      });

      // style exception, too simple

    }
  });

};

exports.deleteFilter = function(login, parameters, callback) {

  boards.findOne({
    boardUri : parameters.boardUri
  }, function gotBoard(error, board) {
    if (error) {
      callback(error);
    } else if (!board) {
      callback(lang.errBoardNotFound);
    } else if (board.owner !== login) {
      callback(lang.errDeniedChangeBoardSettings);
    } else {

      var existingFilters = board.filters || [];

      for (var i = 0; i < existingFilters.length; i++) {
        var filter = existingFilters[i];
        if (filter.originalTerm === parameters.filterIdentifier) {

          existingFilters.splice(i, 1);

          break;
        }

      }

      // style exception, too simple

      boards.updateOne({
        boardUri : parameters.boardUri
      }, {
        $set : {
          filters : existingFilters
        }
      }, function updatedFilters(error) {
        callback(error);
      });

      // style exception, too simple

    }
  });

};

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