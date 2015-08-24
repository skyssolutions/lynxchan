'use strict';

var db = require('../../db');
var boards = db.boards();
var miscOps = require('../miscOps');
var lang = require('../langOps').languagePack();
var settings = require('../../boot').getGeneralSettings();

var maxFiltersCount = settings.maxFilters;

var filterParameters = [ {
  field : 'originalTerm',
  length : 32
}, {
  field : 'replacementTerm',
  length : 32,
  removeHTML : true
} ];

// Section 1: Filter creation {
function setFilter(board, callback, parameters) {
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

  boards.updateOne({
    boardUri : parameters.boardUri
  }, {
    $set : {
      filters : existingFilters
    }
  }, function updatedFilters(error) {
    callback(error);
  });

}

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
    } else if (board.filters && board.filters.length >= maxFiltersCount) {
      callback(lang.errMaxFiltersReached);
    } else {
      setFilter(board, callback, parameters);
    }
  });

};
// } Section 1: Filter creation

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