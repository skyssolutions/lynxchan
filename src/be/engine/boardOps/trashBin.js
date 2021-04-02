'use strict';

var db = require('../../db');
var boards = db.boards();
var modCommonOps;
var lang;

exports.loadDependencies = function() {
  lang = require('../langOps').languagePack;
  modCommonOps = require('../modOps').common;
};

exports.getTrash = function(user, parameters, language, callback) {

  boards.findOne({
    boardUri : parameters.boardUri
  }, function(error, foundBoard) {

    if (error) {
      return callback(error);
    } else if (!foundBoard) {
      return callback(lang(language).errBoardNotFound);
    } else if (modCommonOps.isInBoardStaff(user, foundBoard)) {
      // TODO
      callback(null, [], [], {});
    } else {
      callback(lang(language).errDeniedManageBoard);
    }

  });

};