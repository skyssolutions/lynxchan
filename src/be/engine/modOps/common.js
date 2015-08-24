'use strict';

exports.isInBoardStaff = function(userData, board) {

  var isOwner = board.owner === userData.login;

  var volunteers = board.volunteers || [];

  var isVolunteer = volunteers.indexOf(userData.login) > -1;

  return isOwner || isVolunteer;
};