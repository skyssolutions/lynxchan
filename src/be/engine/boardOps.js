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

function managerVolunteer(currentVolunteers, parameters, callback) {

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

    boards.update({
      boardUri : parameters.boardUri
    }, operation, function updatedVolunteers(error) {
      callback(error);
    });

  }

}

exports.setVolunteer = function(userData, parameters, callback) {

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
      managerVolunteer(board.volunteers || [], parameters, callback);
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