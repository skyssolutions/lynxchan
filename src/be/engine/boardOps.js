'use strict';

// handles board operations

var mongo = require('mongodb');
var ObjectID = mongo.ObjectID;
var db = require('../db');
var miscOps = require('./miscOps');
var gridFsHandler = require('./gridFsHandler');
var files = db.files();
var reports = db.reports();
var users = db.users();
var boards = db.boards();
var settings = require('../boot').getGeneralSettings();
var restrictedBoardCreation = settings.restrictBoardCreation;

var newBoardParameters = [ {
  field : 'boardUri',
  length : 32
}, {
  field : 'boardName',
  length : 32
}, {
  field : 'boardDescription',
  length : 128
} ];

function updateUsersOwnedBoards(userData, parameters, callback) {

  users.update({
    login : userData.login
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

function performTransfer(userData, parameters, callback) {

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
      updateUsersOwnedBoards(userData, parameters, callback);
    }

  });

}

exports.transfer = function(userData, parameters, callback) {

  if (userData.login === parameters.login) {
    callback();
    return;

  }

  boards.findOne({
    boardUri : parameters.boardUri
  }, {
    _id : 0,
    owner : 1
  }, function gotBoard(error, board) {
    if (error) {
      callback(error);
    } else if (!board) {
      callback('Board not found');
    } else if (userData.login !== board.owner) {
      callback('You are not allowed to perform this operation');
    } else {

      // style exception, too simple
      users.count({
        login : parameters.login
      }, function gotCount(error, count) {
        if (error) {
          callback(error);
        } else if (!count) {
          callback('User not found');
        } else {
          performTransfer(userData, parameters, callback);
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
        callback('User not found');
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
    callback('You cannot set yourself as a volunteer.');
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
      callback('Board not found');
    } else if (board.owner !== userData.login) {
      callback('You are not allowed to set volunteers on this board');
    } else {
      manageVolunteer(board.volunteers || [], parameters, callback);
    }
  });

};

function isAllowedToManageBoard(login, role, boardData) {

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

exports.getBoardManagementData = function(login, role, board, callback) {

  boards.findOne({
    boardUri : board
  }, {
    _id : 0,
    owner : 1,
    boardUri : 1,
    boardName : 1,
    volunteers : 1
  }, function(error, boardData) {
    if (error) {
      callback(error);
    } else if (!boardData) {
      callback('Board not found');
    } else if (isAllowedToManageBoard(login, role, boardData)) {
      getBoardReports(boardData, callback);
    } else {
      callback('You are not allowed to manage this board.');
    }
  });

};

exports.createBoard = function(parameters, userData, callback) {

  var role = userData.globalRole || 4;

  if (role > 1 && restrictedBoardCreation) {
    callback('Board creation is restricted to just root and admin users.');
    return;
  }

  miscOps.sanitizeStrings(parameters, newBoardParameters);

  if (/\W/.test(parameters.boardUri)) {
    callback('Invalid uri');
    return;
  }

  boards.insert({
    boardUri : parameters.boardUri,
    boardName : parameters.boardName,
    boardDescription : parameters.boardDescription,
    owner : userData.login
  }, function insertedBoard(error) {
    if (error && error.code !== 11000) {
      callback(error);
    } else if (error) {
      callback('Uri already in use.');
    } else {

      // style exception, too simple

      users.update({
        login : userData.login
      }, {
        $push : {
          ownedBoards : parameters.boardUri
        }
      }, function updatedUser(error) {
        // signal rebuild of board pages
        process.send({
          board : parameters.boardUri
        });

        process.send({
          frontPage : true
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
      callback('Board not found.');
    } else if (board.owner !== user) {
      callback('You are not allowed to manage this board\'s banners.');
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
    callback('No files sent.');
    return;
  } else if (parameters.files[0].mime.indexOf('image/') === -1) {
    callback('File is not an image');
    return;
  }

  boards.findOne({
    boardUri : parameters.boardUri
  }, function gotBoard(error, board) {
    if (error) {
      callback(error);
    } else if (!board) {
      callback('Board not found.');
    } else if (board.owner !== user) {
      callback('You are not allowed to create banners for this board.');
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

  files.findOne({
    _id : new ObjectID(parameters.bannerId)
  }, function gotBanner(error, banner) {
    if (error) {
      callback(error);
    } else if (!banner) {
      callback('Banner not found');
    } else {
      // style exception, too simple

      boards.findOne({
        boardUri : banner.metadata.boardUri
      }, function gotBoard(error, board) {
        if (error) {
          callback(error);
        } else if (!board) {
          callback('Board not found');
        } else if (board.owner !== login) {
          callback('You are not allowed to delete banners from this board');
        } else {
          removeBanner(banner, callback);
        }
      });
      // style exception, too simple

    }

  });

};
// end of banner deletion
