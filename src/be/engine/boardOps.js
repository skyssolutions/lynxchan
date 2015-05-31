'use strict';

// handles board operations

var db = require('../db');
var miscOps = require('./miscOps');
var users = db.users();
var boards = db.boards();

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

  var inGlobalStaff = role <= miscOps.getMaxStaffRole();

  var owner = login === boardData.owner;

  var volunteer;

  if (boardData.volunteers) {
    volunteer = boardData.volunteers.indexOf(login) > -1;
  }

  return inGlobalStaff || owner || volunteer;

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
      callback(null, boardData);
    } else {
      callback('You are not allowed to manage this board.');
    }
  });

};

exports.createBoard = function(parameters, user, callback) {

  miscOps.sanitizeStrings(parameters, newBoardParameters);

  if (/\W/.test(parameters.boardUri)) {
    callback('Invalid uri');
    return;
  }

  boards.insert({
    boardUri : parameters.boardUri,
    boardName : parameters.boardName,
    boardDescription : parameters.boardDescription,
    owner : user
  }, function insertedBoard(error) {
    if (error && error.code !== 11000) {
      callback(error);
    } else if (error) {
      callback('Uri already in use.');
    } else {

      // style exception, too simple

      users.update({
        login : user
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