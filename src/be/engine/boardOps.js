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
    if (error) {
      callback(error);
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