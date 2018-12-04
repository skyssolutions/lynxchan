'use strict';

// handle board filter operations

var maxFiltersCount;
var db = require('../../db');
var boards = db.boards();
var miscOps;
var lang;

var globalBoardModeration;

exports.loadSettings = function() {
  var settings = require('../../settingsHandler').getGeneralSettings();
  maxFiltersCount = settings.maxFilters;
  globalBoardModeration = settings.allowGlobalBoardModeration;
};

exports.loadDependencies = function() {

  miscOps = require('../miscOps');
  lang = require('../langOps').languagePack;

};

var filterParameters = [ {
  field : 'originalTerm',
  length : 32
}, {
  field : 'replacementTerm',
  length : 32,
  removeHTML : true
} ];

// Section 1: Filter creation {
exports.setFilter = function(board, callback, parameters) {
  var existingFilters = board.filters || [];

  var found = false;

  for (var i = 0; i < existingFilters.length; i++) {
    var filter = existingFilters[i];

    if (filter.originalTerm === parameters.originalTerm) {
      found = true;

      filter.caseInsensitive = !!parameters.caseInsensitive;
      filter.replacementTerm = parameters.replacementTerm;

      break;
    }
  }

  if (!found) {

    existingFilters.push({
      originalTerm : parameters.originalTerm,
      replacementTerm : parameters.replacementTerm,
      caseInsensitive : !!parameters.caseInsensitive
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

};

exports.createFilter = function(userData, parameters, language, callback) {

  miscOps.sanitizeStrings(parameters, filterParameters);

  parameters.boardUri = parameters.boardUri.toString();

  var globallyAllowed = userData.globalRole <= 1 && globalBoardModeration;

  boards.findOne({
    boardUri : parameters.boardUri
  }, function gotBoard(error, board) {
    if (error) {
      callback(error);
    } else if (!board) {
      callback(lang(language).errBoardNotFound);
    } else if (board.owner !== userData.login && !globallyAllowed) {
      callback(lang(language).errDeniedChangeBoardSettings);
    } else if (board.filters && board.filters.length >= maxFiltersCount) {
      callback(lang(language).errMaxFiltersReached);
    } else {
      exports.setFilter(board, callback, parameters);
    }
  });

};
// } Section 1: Filter creation

exports.deleteFilter = function(userData, parameters, language, callback) {

  var globallyAllowed = userData.globalRole <= 1 && globalBoardModeration;

  parameters.boardUri = parameters.boardUri.toString();

  boards.findOne({
    boardUri : parameters.boardUri
  }, function gotBoard(error, board) {
    if (error) {
      callback(error);
    } else if (!board) {
      callback(lang(language).errBoardNotFound);
    } else if (board.owner !== userData.login && !globallyAllowed) {
      callback(lang(language).errDeniedChangeBoardSettings);
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

exports.getFilterData = function(userData, boardUri, language, callback) {

  var globallyAllowed = userData.globalRole <= 1 && globalBoardModeration;

  boards.findOne({
    boardUri : boardUri
  }, function gotBoard(error, board) {
    if (error) {
      callback(error);
    } else if (!board) {
      callback(lang(language).errBoardNotFound);
    } else if (userData.login !== board.owner && !globallyAllowed) {
      callback(lang(language).errDeniedChangeBoardSettings);
    } else {
      callback(null, board.filters || []);
    }
  });

};